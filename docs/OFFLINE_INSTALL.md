# 🔌 Offline / Manual Installation

For users who prefer to inspect, verify, and manually install Ci5 without using the automated curl pipeline.

**Target Audience:** Security-conscious users, air-gapped networks, auditors.

---

## Option 1: Source Inspection

### Clone All Repositories

```bash
git clone https://github.com/dreamswag/ci5
git clone https://github.com/dreamswag/ci5.run
git clone https://github.com/dreamswag/ci5.host
git clone https://github.com/dreamswag/ci5.dev
git clone https://github.com/dreamswag/ci5.network
```

### Audit Scripts

All scripts are shell (`.sh`) — human-readable:

```bash
# Review installer
less ci5/install-full.sh

# Review network configuration
less ci5/configs/network_init.sh

# Review firewall rules
less ci5/configs/firewall_init.sh
```

### Verify Checksums

```bash
# Generate checksum of installer
sha256sum ci5/install-full.sh

# Compare against published release
curl -s https://github.com/dreamswag/ci5/releases/latest | grep sha256
```

---

## Option 2: only_fat.zip (Planned)

A bundled archive containing:
- Pre-built Golden Image
- All scripts
- Docker images (exported)
- Checksums

**Status:** Not yet implemented. Track progress in GitHub Issues.

---

## Option 3: Manual Step-by-Step

### Prerequisites

- Fresh OpenWrt on Pi 5
- SSH access
- Git and curl installed

### Step 1: Prepare OpenWrt

```bash
opkg update
opkg install git-http curl ca-certificates
```

### Step 2: Clone Repository

```bash
mkdir -p /opt
git clone https://github.com/dreamswag/ci5 /opt/ci5
cd /opt/ci5
```

### Step 3: Run Setup Wizard

```bash
sh setup.sh
```

Answer prompts. This generates `ci5.config`.

### Step 4: Apply Configuration

**Network:**
```bash
sh configs/network_init.sh
```

**Firewall:**
```bash
sh configs/firewall_init.sh
```

**SQM:**
```bash
sh configs/sqm_init.sh
```

**DNS:**
```bash
cp configs/unbound /etc/config/unbound
/etc/init.d/unbound enable
/etc/init.d/unbound restart
```

**Kernel Tuning:**
```bash
cat configs/tuning_sysctl.conf > /etc/sysctl.conf
sysctl -p
cat configs/tuning_rclocal.sh > /etc/rc.local
chmod +x /etc/rc.local
```

### Step 5: Validate

```bash
sh validate.sh
```

### Step 6 (Optional): Docker Stack

```bash
opkg install dockerd docker-compose
/etc/init.d/dockerd enable
/etc/init.d/dockerd start

cd /opt/ci5/docker
docker compose up -d                    # Core only
docker compose --profile full up -d     # Full stack
```

---

## Air-Gapped Deployment

For networks without internet access:

### On Connected Machine

Pull and export all Docker images:

```bash
docker pull adguard/adguardhome:latest
docker pull mvance/unbound:latest
docker pull jasonish/suricata:latest
docker pull crowdsecurity/crowdsec:latest
docker pull ntop/ntopng_arm64.dev:latest
docker pull redis:7.2-bookworm

docker save -o ci5-images.tar \
  adguard/adguardhome \
  mvance/unbound \
  jasonish/suricata \
  crowdsecurity/crowdsec \
  ntop/ntopng_arm64.dev \
  redis:7.2-bookworm
```

### Transfer to Air-Gapped Network

Use USB drive or secure file transfer.

### On Air-Gapped Pi 5

```bash
docker load -i ci5-images.tar
```

Proceed with manual installation from Step 4.

---

## Verification Points

Before trusting a Ci5 installation:

| Check | Command | Expected |
|-------|---------|----------|
| Repo origin | `git remote -v` | `github.com/dreamswag/ci5` |
| Branch | `git branch` | `main` |
| Latest commit | `git log -1` | Match GitHub HEAD |
| Script integrity | `sha256sum *.sh` | Match release |
| No modifications | `git status` | Clean |

### Full Verification Script

```bash
#!/bin/sh
# verify_ci5.sh - Run from /opt/ci5

echo "=== Ci5 Integrity Check ==="

# Check remote
REMOTE=$(git remote get-url origin)
if echo "$REMOTE" | grep -q "dreamswag/ci5"; then
    echo "[OK] Remote: $REMOTE"
else
    echo "[WARN] Unexpected remote: $REMOTE"
fi

# Check branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" = "main" ]; then
    echo "[OK] Branch: main"
else
    echo "[WARN] Not on main branch: $BRANCH"
fi

# Check for local modifications
if git diff-index --quiet HEAD --; then
    echo "[OK] No local modifications"
else
    echo "[WARN] Local modifications detected"
    git status --short
fi

# Show current commit
echo ""
echo "Current commit:"
git log -1 --format="  %H%n  %s%n  %ai"
```

---

## Building Golden Image from Source

For maximum verification, build the image yourself:

### Requirements

- Linux host with Docker
- 32GB+ storage
- OpenWrt Image Builder

### Process

```bash
# Clone OpenWrt Image Builder for bcm27xx
git clone https://github.com/openwrt/openwrt.git
cd openwrt
git checkout v23.05.2

# Configure for Pi 5
./scripts/feeds update -a
./scripts/feeds install -a

# Build with Ci5 packages included
make menuconfig
# Select: Target System → Broadcom BCM27xx
# Select: Target Profile → Raspberry Pi 5

make -j$(nproc)
```

Inject Ci5 files into resulting image using loop mount.

---

## Trust Model

| Component | Trust Source |
|-----------|--------------|
| OpenWrt base | openwrt.org releases |
| Ci5 scripts | GitHub + commit signatures |
| Docker images | Docker Hub official images |
| Community Corks | CURE audit before use |

The weakest link is typically community Corks. Always audit before installation.
