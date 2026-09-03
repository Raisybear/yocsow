# Ubuntu development setup

This guide prepares a Windows computer for YOCSOW development using WSL2 and
Ubuntu 24.04 LTS.

## 1. Install WSL2

Run the following command from PowerShell using the normal Windows account
that will be used for development:

```powershell
wsl --install -d Ubuntu-24.04
```

Restart Windows if requested. During the first Ubuntu launch, create a Linux
username and password.

Verify the installation from PowerShell:

```powershell
wsl --status
wsl --list --verbose
```

Ubuntu must use WSL version 2.

## 2. Install Ubuntu packages

Open Ubuntu and update the package index:

```bash
sudo apt update
```

Install the required development and Tauri packages:

```bash
sudo apt install -y \
  build-essential \
  curl \
  file \
  git \
  keychain \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libssl-dev \
  libwebkit2gtk-4.1-dev \
  libxdo-dev \
  unzip \
  wget \
  zip
```

Project files should be stored inside the Linux filesystem, for example:

```text
/home/<user>/projects/yocsow
```

Do not use `/mnt/c/...` as the primary development directory.

## 3. Configure Git

Configure the commit author:

```bash
git config --global user.name "Your Name"
git config --global user.email "your-verified-github-email@example.com"
git config --global init.defaultBranch main
git config --global pull.ff only
git config --global fetch.prune true
git config --global core.autocrlf input
```

The Git author name does not need to match the GitHub username. The email
should be verified by the GitHub account or replaced with the GitHub-provided
private commit email.

## 4. Configure GitHub SSH authentication

Create a separate SSH key on every development computer:

```bash
ssh-keygen -t ed25519 -C "your-verified-github-email@example.com"
```

Start the SSH agent and add the key:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

Copy the public key to the Windows clipboard:

```bash
clip.exe < ~/.ssh/id_ed25519.pub
```

Add the key under GitHub account settings:

```text
Settings → SSH and GPG keys → New SSH key
```

Test the connection:

```bash
ssh -T git@github.com
```

A successful connection identifies the GitHub account and explains that
GitHub does not provide shell access.

To reuse the SSH agent between terminal sessions, add this line to
`~/.bashrc`:

```bash
eval "$(keychain --eval --quiet id_ed25519)"
```

Never copy private SSH keys between devices and never commit them.

## 5. Install SDKMAN

Install SDKMAN using its official installer:

```bash
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk version
```

The repository bootstrap installs and activates the Java version declared in
`.sdkmanrc`.

## 6. Install NVM

Install the pinned NVM release:

```bash
curl -o- \
  https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh |
  METHOD=script bash
```

Load NVM in the current shell:

```bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm --version
```

The repository bootstrap installs and activates the Node.js version declared
in `.nvmrc`.

## 7. Install rustup

Install rustup using its official installer:

```bash
curl --proto '=https' \
  --tlsv1.2 \
  -sSf \
  https://sh.rustup.rs |
  sh -s -- --profile minimal -y
```

Load Cargo in the current shell:

```bash
source "$HOME/.cargo/env"
rustup --version
```

The repository's `rust-toolchain.toml` selects the required Rust compiler and
components.

## 8. Clone and bootstrap YOCSOW

Create the project directory and clone the repository:

```bash
mkdir -p ~/projects
cd ~/projects
git clone git@github.com:Raisybear/yocsow.git
cd yocsow
```

Prepare the complete working copy:

```bash
./scripts/bootstrap-ubuntu.sh
```

The bootstrap script:

- checks required Ubuntu packages;
- installs and activates the repository Java version;
- installs and activates the repository Node.js version;
- activates the repository Rust toolchain;
- installs locked npm dependencies;
- prepares Gradle and Cargo dependencies;
- runs the complete project verification.

## 9. Daily development workflow

At the beginning of a new task:

```bash
git switch main
git pull --ff-only
git switch -c <type>/<short-description>
git push -u origin HEAD
```

Examples:

```text
feat/seed-constraints
fix/native-window-startup
test/engine-boundaries
chore/dependency-update
```

Before switching to another computer:

```bash
./scripts/verify.sh
git status
git add <specific-files>
git commit -m "<type>(<scope>): <description>"
git push
```

On the other computer:

```bash
git fetch --prune
git switch <existing-branch>
git pull --ff-only
```

Do not synchronize a working copy with OneDrive, Dropbox, or another file
synchronization service. Every computer must use its own Git clone.

## 10. Useful commands

Verify all installed tool versions:

```bash
./scripts/verify-toolchain.sh
```

Verify the complete project:

```bash
./scripts/verify.sh
```

Start the native desktop application:

```bash
npm run dev:desktop:native
```

Build an optimized native binary without an installer:

```bash
npm run build:desktop:native -- --no-bundle
```

## Official references

- [Microsoft WSL installation](https://learn.microsoft.com/windows/wsl/install)
- [SDKMAN installation](https://sdkman.io/install/)
- [NVM installation](https://github.com/nvm-sh/nvm)
- [rustup installation](https://rustup.rs/)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
