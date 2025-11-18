# browsertools Configuration Guide

## Overview

The `~/.browsertools/config.json` file allows you to customize how the MCP server is launched, enabling different Chrome configurations for different environments.

## Creating Config

```bash
uv run .agents/tools/chrome-devtools/browsertools.py daemon config
```

This creates `~/.browsertools/config.json` with defaults and examples.

## Config Structure

```json
{
  "mcp_command": "npx",
  "mcp_args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
}
```

**Fields:**
- `mcp_command` (string): Command to run (usually `npx`)
- `mcp_args` (array): Arguments passed to command

## Environment-Specific Configs

### Local Development (Default)
Visual Chrome with isolated profile:

```json
{
  "mcp_command": "npx",
  "mcp_args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
}
```

### CI/Headless Servers
Headless mode for automation servers:

```json
{
  "mcp_command": "npx",
  "mcp_args": [
    "-y",
    "chrome-devtools-mcp@latest",
    "--isolated",
    "--headless=true"
  ]
}
```

### Sandbox Environment
Custom Chromium binary with headless:

```json
{
  "mcp_command": "npx",
  "mcp_args": [
    "-y",
    "chrome-devtools-mcp@latest",
    "--isolated=true",
    "--headless=true",
    "--executablePath=/usr/local/bin/chromium-mcp"
  ]
}
```

**Use case:** Sandboxed environments with custom Chrome wrapper

### Docker/Container
Headless with no sandbox (required in some containers):

```json
{
  "mcp_command": "npx",
  "mcp_args": [
    "-y",
    "chrome-devtools-mcp@latest",
    "--headless=true",
    "--no-sandbox",
    "--disable-dev-shm-usage"
  ]
}
```

## Available chrome-devtools-mcp Flags

### Chrome Location
- `--executablePath=/path/to/chrome` - Use specific Chrome binary
- `--wsEndpoint=ws://...` - Connect to existing Chrome instance

### Display Mode
- `--headless=true` - Run without UI (for servers/CI)
- `--headless=false` - Show Chrome window (default, good for debugging)

### Isolation
- `--isolated` - Use temporary profile (default in bt)
- `--isolated=false` - Use persistent profile (shares cookies/storage across sessions)

### Performance
- `--no-sandbox` - Disable Chrome sandbox (needed in some containers)
- `--disable-dev-shm-usage` - Use /tmp instead of /dev/shm (Docker)
- `--disable-gpu` - Disable GPU acceleration

### Debugging
- `--verbose` - Enable verbose logging from chrome-devtools-mcp

## Config by Use Case

### Local UAT (Visual)
```json
{
  "mcp_args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
}
```
✅ See what's happening
✅ Isolated test environment

### CI Pipeline
```json
{
  "mcp_args": ["-y", "chrome-devtools-mcp@latest", "--isolated", "--headless=true"]
}
```
✅ Fast
✅ No display required
✅ Isolated

### Docker Container
```json
{
  "mcp_args": [
    "-y",
    "chrome-devtools-mcp@latest",
    "--headless=true",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu"
  ]
}
```
✅ Works in restricted environments
✅ No X11/display needed

### Sandbox with Custom Binary
```json
{
  "mcp_args": [
    "-y",
    "chrome-devtools-mcp@latest",
    "--isolated=true",
    "--headless=true",
    "--executablePath=/usr/local/bin/chromium-mcp"
  ]
}
```
✅ Your exact use case
✅ Custom Chrome wrapper
✅ Controlled environment

## Applying Config Changes

1. **Edit config:**
   ```bash
   vi ~/.browsertools/config.json
   ```

2. **Restart daemon:**
   ```bash
   uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
   uv run .agents/tools/chrome-devtools/browsertools.py daemon start
   ```

3. **Verify:**
   ```bash
   uv run .agents/tools/chrome-devtools/browsertools.py daemon status
   # Check stderr output shows your custom args
   ```

## Verification

When daemon starts, it prints the command being executed:

```
Starting chrome-devtools-mcp...
Command: npx -y chrome-devtools-mcp@latest --isolated --headless=true
```

Check this matches your config.

## Troubleshooting

### Config not loading
```bash
# Check file exists and is valid JSON
cat ~/.browsertools/config.json | python3 -m json.tool
```

### Custom executable not found
```bash
# Verify path exists
ls -la /usr/local/bin/chromium-mcp

# Test it works
/usr/local/bin/chromium-mcp --version
```

### Config ignored
```bash
# Make sure daemon was restarted after config change
uv run .agents/tools/chrome-devtools/browsertools.py daemon stop
uv run .agents/tools/chrome-devtools/browsertools.py daemon start
```

## Example: Setting Up Sandbox Config

For your sandbox environment:

```bash
# 1. Generate default config
uv run .agents/tools/chrome-devtools/browsertools.py daemon config

# 2. Edit for sandbox
cat > ~/.browsertools/config.json << 'EOF'
{
  "mcp_command": "npx",
  "mcp_args": [
    "-y",
    "chrome-devtools-mcp@latest",
    "--isolated=true",
    "--headless=true",
    "--executablePath=/usr/local/bin/chromium-mcp"
  ]
}
EOF

# 3. Start daemon (will use sandbox config)
uv run .agents/tools/chrome-devtools/browsertools.py daemon start

# 4. Verify it's using your custom Chrome
uv run .agents/tools/chrome-devtools/browsertools.py nav http://example.com
# Should work with chromium-mcp binary
```

## Config Persistence

- Config file persists across daemon restarts
- Config is per-user (in `~/.browsertools/`)
- Different users on same machine can have different configs
- Delete `~/.browsertools/config.json` to reset to defaults

## Security Note

The config file controls what binary gets executed. Only use trusted config files to avoid security issues.
