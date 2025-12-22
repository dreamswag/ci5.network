# 🧪 Cork Registry & Auditing

## Overview

Corks are Docker containers designed to utilize the Pi 5's "Leeway" RAM. 

This document covers the registry system and security auditing procedures.

## The Registry

The authoritative Cork registry is maintained at:

**https://ci5.dev/corks.json**

### Registry Structure

```json
{
  "official": {
    "cork-name": {
      "repo": "dreamswag/cork-name",
      "desc": "Description",
      "ram": "128MB"
    }
  },
  "community": {
    "cork-name": {
      "repo": "community/cork-name",
      "desc": "Description",
      "ram": "1GB"
    }
  }
}
```

### Current Official Corks

| Cork | Purpose | RAM |
|------|---------|-----|
| adguard | Network-wide ad/tracker blocking | 128MB |
| unbound | Recursive caching DNS resolver | 64MB |
| ntopng | Traffic analysis and flow monitoring | 256MB |

### Current Community Corks

| Cork | Purpose | RAM |
|------|---------|-----|
| tor-relay | Onion routing relay node | 512MB |
| minecraft-paper | PaperMC Server | 4GB+ |
| home-assistant | Home automation hub | 1GB |
| monero-node | Monero (XMR) Daemon | 2GB |
| ethereum-node | Ethereum Execution Client | 4GB |
| bitcoin-node | Full Bitcoin L1 node | 2GB |

---

## Installing Corks

### Method 1: Soul Injection (Recommended)

Create `/etc/ci5_corks` with a list of Cork repos:

```bash
echo "dreamswag/cork-ntopng" > /etc/ci5_corks
echo "community/cork-home-assistant" >> /etc/ci5_corks
```

Then deploy:

```bash
curl ci5.run/free | sh
```

The installer will pull and start all listed Corks.

### Method 2: Manual Installation

```bash
cd /opt/ci5/corks
git clone https://github.com/community/cork-name
cd cork-name
docker compose up -d
```

---

## Cork Auditing (ci5.host)

Before installing community Corks, audit them for host-infection attempts.

### The Problem

On standard ext4 filesystems, there's no read-only safety net. 

A malicious container could:
- Modify `/etc/config`
- Install backdoors
- Compromise routing

### The Solution: CURE (Ephemeral Overlays)

The `ci5.host/audit.sh` script creates a RAM-backed overlay:

```bash
curl ci5.host/audit | sh -s cork-name
```

### How CURE Works

```
┌─────────────────────────────────────────┐
│            OverlayFS Mount              │
├─────────────────────────────────────────┤
│  Upperdir (tmpfs/RAM)  ← Catches writes │
├─────────────────────────────────────────┤
│  Lowerdir (/etc)       ← Read-only      │
└─────────────────────────────────────────┘
```

1. Cork runs in sandbox with shadow `/etc`
2. Any write attempts go to RAM
3. Script diffs RAM to reveal modifications
4. Result: `SAFE` or `MALICIOUS`

### Audit Output Example

```
--- [Ci5 AUDIT: CURE MODE] ---
ID: a1b2c3d4e5f6 | Host: ext4-Sovereign

[*] Shadow-Mount created. Host /etc is now protected.
--- SUBJECT IS LIVE IN SHADOW-NET ---
Monitoring for 30 seconds (or Ctrl+C)...
..............................

--- [TANGIBLE CHANGE REPORT] ---
[Internal Cork Changes]
C /var/log/nginx/access.log
A /tmp/session_data

[Host Breakout Attempts]
 > CLEAN: No host configuration changes detected.

--- [AUDIT COMPLETE] ---
Result: SAFE
```

---

## Contributing Corks

To submit a community Cork:

1. Create a repo containing `docker-compose.yml`
2. Ensure ARM64 images (or multi-arch)
3. Handle persistence via volumes
4. Fork [ci5.dev](https://github.com/dreamswag/ci5.dev)
5. Add entry to `corks.json`
6. Submit PR

### Requirements

| Requirement | Rationale |
|-------------|-----------|
| No host network modifications | Security isolation |
| Declared RAM usage in metadata | Leeway planning |
| Passes CURE audit | Trust verification |
| Documented ports/volumes | User awareness |

---

## Hash Attribution

For trust verification, Cork integrity is tracked via Git commit hashes:

```bash
# Check current Cork versions
cd /opt/ci5/corks/cork-name
git log -1 --format="%H"
```

The `ci5.run` terminal displays the current core repo hash:

```
CORK INTEGRITY: [a1b2c3d]
```

### Verifying Cork Source

```bash
# Verify remote origin
git remote -v

# Check for local modifications
git status

# Compare to upstream
git fetch origin
git diff HEAD origin/main
```

---

## Removing Corks

### Single Cork Removal

```bash
cd /opt/ci5/corks/cork-name
docker compose down
cd ..
rm -rf cork-name
```

### Bulk Removal via TUI

```bash
sh /root/ci5/extras/uninstallers/partial-uninstall.sh
```

Interactive menu for selective component removal.

---
