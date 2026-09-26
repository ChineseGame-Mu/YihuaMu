# Task 1 proven clean-room Guandan backend port

Source deployment: https://yihua-mu.vercel.app/
Vercel deployment: dpl_3d2RcM9wFAWGUZ2dBcpeTgRSargy
Source branch: cleanroom/yihua-game-20260826
Source commit: 9c6790e4ee7382c4f3a6c39d320b06df8269f966

## Port scope

The complete `yihua-game/` clean-room subtree from the proven Task 1 commit was overlaid onto
`commercial-cleanroom/guandan/` on the Task 4 commercial branch. Target-only Task 4 bridge and
three-game integration files remain in place.

This imports the independently developed clean-room Guandan core, protocol, room/session management,
reconnect/revision handling, persistence/restart recovery, robot strategy, network smoke/soak scripts,
and the complete clean-room test suite.

It does not copy or make the historical upstream Shengji backend a production dependency.

## Required verification after the port

The port is not accepted merely because the source deployment was previously tested. The current
Task 4 candidate SHA must rerun its own format/type/unit/build/network/reconnect/crash/soak gates,
the ported 4/6/8/10/12/14 expert matrix, and the separate real three-game live acceptance gates.
