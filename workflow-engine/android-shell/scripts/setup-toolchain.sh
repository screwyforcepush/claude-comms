#!/usr/bin/env bash
set -euo pipefail

TOOLCHAIN_ROOT="${ANDROID_TOOLCHAIN_ROOT:-"$HOME/.android-toolchain"}"
NODE_VERSION="${ANDROID_NODE_VERSION:-22.20.0}"
NODE_HOME="$TOOLCHAIN_ROOT/node-22"
JDK_HOME="$TOOLCHAIN_ROOT/jdk-21"
SDK_ROOT="$TOOLCHAIN_ROOT/sdk"
CMDLINE_TOOLS_VERSION="${ANDROID_CMDLINE_TOOLS_VERSION:-13114758}"

case "$(uname -m)" in
  aarch64|arm64)
    NODE_ARCH="arm64"
    JDK_ARCH="aarch64"
    NEEDS_AMD64_LIBS="1"
    ;;
  x86_64|amd64)
    NODE_ARCH="x64"
    JDK_ARCH="x64"
    NEEDS_AMD64_LIBS="0"
    ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

NODE_DIST="node-v$NODE_VERSION-linux-$NODE_ARCH"
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/$NODE_DIST.tar.xz"
JDK_URL="https://api.adoptium.net/v3/binary/latest/21/ga/linux/$JDK_ARCH/jdk/hotspot/normal/eclipse"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"
SDKMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"

print_env() {
  cat <<EOF
export JAVA_HOME="$JDK_HOME"
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="$NODE_HOME/bin:$JDK_HOME/bin:$SDK_ROOT/platform-tools:$SDK_ROOT/cmdline-tools/latest/bin:\$PATH"
EOF
}

if [[ "${1:-}" == "--print-env" ]]; then
  print_env
  exit 0
fi

log() {
  printf '[android-toolchain] %s\n' "$*"
}

run_with_sudo() {
  if [[ "$(id -u)" == "0" ]]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo "$@"
    return
  fi

  log "Skipping system package install: passwordless sudo is unavailable."
  log "If Android build tools fail to execute on arm64 Linux, install libc6:amd64 libstdc++6:amd64 zlib1g:amd64."
}

install_system_packages() {
  command -v apt-get >/dev/null 2>&1 || return 0

  local packages=(ca-certificates curl tar unzip xz-utils)
  if [[ "$NEEDS_AMD64_LIBS" == "1" ]]; then
    if command -v dpkg >/dev/null 2>&1 && ! dpkg --print-foreign-architectures | grep -qx amd64; then
      log "Enabling amd64 package architecture."
      run_with_sudo dpkg --add-architecture amd64
    fi
    packages+=(libc6:amd64 libstdc++6:amd64 zlib1g:amd64)
  fi

  log "Installing required system packages."
  run_with_sudo env DEBIAN_FRONTEND=noninteractive apt-get update
  run_with_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
}

replace_dir() {
  local source_dir="$1"
  local target_dir="$2"
  rm -rf "$target_dir.tmp"
  mv "$source_dir" "$target_dir.tmp"
  rm -rf "$target_dir"
  mv "$target_dir.tmp" "$target_dir"
}

install_node() {
  if [[ -x "$NODE_HOME/bin/node" ]] && "$NODE_HOME/bin/node" -v | grep -qx "v$NODE_VERSION"; then
    log "Node v$NODE_VERSION already installed at $NODE_HOME."
    return 0
  fi

  log "Installing Node v$NODE_VERSION at $NODE_HOME."
  local work_dir
  work_dir="$(mktemp -d "$TOOLCHAIN_ROOT/node.XXXXXX")"
  trap 'rm -rf "$work_dir"' RETURN
  curl -fsSL "$NODE_URL" -o "$work_dir/node.tar.xz"
  tar -xJf "$work_dir/node.tar.xz" -C "$work_dir"
  replace_dir "$work_dir/$NODE_DIST" "$NODE_HOME"
}

install_jdk() {
  if [[ -x "$JDK_HOME/bin/java" ]] && "$JDK_HOME/bin/java" -version 2>&1 | grep -q 'version "21\.'; then
    log "JDK 21 already installed at $JDK_HOME."
    return 0
  fi

  log "Installing JDK 21 at $JDK_HOME."
  local work_dir extracted
  work_dir="$(mktemp -d "$TOOLCHAIN_ROOT/jdk.XXXXXX")"
  trap 'rm -rf "$work_dir"' RETURN
  curl -fL "$JDK_URL" -o "$work_dir/jdk.tar.gz"
  mkdir -p "$work_dir/extract"
  tar -xzf "$work_dir/jdk.tar.gz" -C "$work_dir/extract"
  extracted="$(find "$work_dir/extract" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [[ -z "$extracted" ]]; then
    echo "Unable to locate extracted JDK directory." >&2
    exit 1
  fi
  replace_dir "$extracted" "$JDK_HOME"
}

install_android_sdk() {
  if [[ ! -x "$SDKMANAGER" ]]; then
    log "Installing Android command line tools at $SDK_ROOT."
    local work_dir
    work_dir="$(mktemp -d "$TOOLCHAIN_ROOT/sdk.XXXXXX")"
    trap 'rm -rf "$work_dir"' RETURN
    curl -fsSL "$CMDLINE_TOOLS_URL" -o "$work_dir/cmdline-tools.zip"
    unzip -q "$work_dir/cmdline-tools.zip" -d "$work_dir"
    rm -rf "$SDK_ROOT/cmdline-tools/latest"
    mkdir -p "$SDK_ROOT/cmdline-tools"
    mv "$work_dir/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  else
    log "Android command line tools already installed at $SDK_ROOT."
  fi

  export JAVA_HOME="$JDK_HOME"
  export ANDROID_HOME="$SDK_ROOT"
  export ANDROID_SDK_ROOT="$SDK_ROOT"
  export PATH="$NODE_HOME/bin:$JDK_HOME/bin:$SDK_ROOT/platform-tools:$SDK_ROOT/cmdline-tools/latest/bin:$PATH"

  log "Accepting Android SDK licenses."
  set +o pipefail
  yes | "$SDKMANAGER" --licenses >/dev/null
  local license_status="${PIPESTATUS[1]}"
  set -o pipefail
  if [[ "$license_status" != "0" ]]; then
    echo "Android SDK license acceptance failed." >&2
    exit "$license_status"
  fi

  log "Installing Android SDK 36 packages."
  "$SDKMANAGER" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
}

mkdir -p "$TOOLCHAIN_ROOT" "$SDK_ROOT"
install_system_packages
install_node
install_jdk
install_android_sdk

log "Toolchain ready."
print_env
