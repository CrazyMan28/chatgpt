# Known Bugs

- **#2** — compound task flows need reliable continuation across question steps
- **#3** — answered questions must resume the waiting task instead of ending at the confirmation event
- **#5** — duplicate compound-dispatch tracking remains open until the merged dispatcher fix is verified on device
- **#7** — agent-loop tool success must not be treated as full goal completion unless the final response explicitly marks the goal complete
- **#8** — fuzzy app parsing must correct typos like `youtuber`/`serch`, split follow-up commands correctly, and support current-app control commands
- **#9** — provider failures must classify 429, auth, timeout, and offline states separately while preserving local deterministic commands

## Notes

- These issues are runtime-specific and should be verified on-device.
- The roadmap keeps the fix scope narrow: parser, runtime continuation, and UI state only.
- Device acceptance still requires real YouTube/search/accessibility checks and provider-fallback behavior with configured keys/endpoints.
