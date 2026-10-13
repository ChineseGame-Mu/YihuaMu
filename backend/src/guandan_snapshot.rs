//! Private, opt-in snapshots of Guandan room state. Never serve these files over HTTP.
//! Set GUANDAN_SNAPSHOT_PATH to a durable, private mounted volume path.
use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};
use storage::{HashMapStorage, Storage};
use crate::guandan_serving_types::{GuandanGameState, VersionedGuandanGame};
use crate::serving_types::VersionedRoom;

#[derive(Serialize, Deserialize)]
struct Snapshot {
    schema: u32,
    rooms: HashMap<String, GuandanGameState>,
}

async fn collect(storage: HashMapStorage<VersionedGuandanGame>) -> anyhow::Result<Snapshot> {
    let mut rooms = HashMap::new();
    for key in storage.clone().get_all_keys().await.map_err(|_| anyhow::anyhow!("list rooms"))? {
        let room = storage.clone().get(key.clone()).await.map_err(|_| anyhow::anyhow!("read room"))?;
        rooms.insert(String::from_utf8(key)?, room.game);
    }
    Ok(Snapshot { schema: 1, rooms })
}

async fn write_private(path: &Path, bytes: &[u8]) -> anyhow::Result<()> {
    let parent = path.parent().ok_or_else(|| anyhow::anyhow!("snapshot path has no parent"))?;
    tokio::fs::create_dir_all(parent).await?;
    let temporary = path.with_extension("pending");
    let mut opts = tokio::fs::OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    use tokio::io::AsyncWriteExt;
    let mut file = opts.open(&temporary).await?;
    file.write_all(bytes).await?;
    file.sync_all().await?;
    drop(file);
    tokio::fs::rename(&temporary, path).await?;
    Ok(())
}

pub async fn save(path: &Path, storage: HashMapStorage<VersionedGuandanGame>) -> anyhow::Result<usize> {
    let snapshot = collect(storage).await?;
    let count = snapshot.rooms.len();
    let bytes = serde_json::to_vec(&snapshot)?;
    write_private(path, &bytes).await?;
    Ok(count)
}

pub async fn restore(path: &Path, storage: HashMapStorage<VersionedGuandanGame>) -> anyhow::Result<usize> {
    let bytes = match tokio::fs::read(path).await {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(e) => return Err(e.into()),
    };
    let snapshot: Snapshot = serde_json::from_slice(&bytes)?;
    anyhow::ensure!(snapshot.schema == 1, "unsupported Guandan snapshot schema");
    let count = snapshot.rooms.len();
    for (name, game) in snapshot.rooms {
        let mut room = VersionedRoom::with_game(name.into_bytes(), game);
        room.monotonic_id = 1;
        storage.clone().put(room).await.map_err(|_| anyhow::anyhow!("restore room"))?;
    }
    Ok(count)
}

pub async fn run_periodic(path: std::path::PathBuf, storage: HashMapStorage<VersionedGuandanGame>) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(30));
    loop {
        ticker.tick().await;
        if let Err(error) = save(&path, storage.clone()).await {
            slog::error!(crate::ROOT_LOGGER, "Guandan snapshot failed"; "error" => error.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use slog::{o, Drain, Logger};
    #[tokio::test]
    async fn snapshot_restore_round_trip() {
        let logger = Logger::root(slog::Discard.fuse(), o!());
        let first = HashMapStorage::<VersionedGuandanGame>::new(logger.clone());
        let mut room = VersionedRoom::with_game(b"0007".to_vec(), GuandanGameState::default());
        room.game.player_names = vec!["Alice".into(), "Bob".into()];
        room.game.turn = 1;
        first.clone().put(room).await.unwrap();
        let path = std::env::temp_dir().join(format!("guandan-restore-{}-{}.json", std::process::id(), 77891));
        assert_eq!(save(&path, first).await.unwrap(), 1);
        let second = HashMapStorage::<VersionedGuandanGame>::new(logger);
        assert_eq!(restore(&path, second.clone()).await.unwrap(), 1);
        let restored = second.get(b"0007".to_vec()).await.unwrap();
        assert_eq!(restored.game.player_names, vec!["Alice", "Bob"]);
        assert_eq!(restored.game.turn, 1);
        tokio::fs::remove_file(path).await.unwrap();
    }
}
