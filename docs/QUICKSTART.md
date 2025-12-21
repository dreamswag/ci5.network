# ⚡ Ci5 Quickstart (5 Minutes to Sovereignty)

## Prerequisites

| Component | Requirement |
|-----------|-------------|
| Hardware | Raspberry Pi 5 (8GB) |
| WAN | USB 3.0 Gigabit NIC (RTL8153) |
| AP | VLAN-capable (R7800 recommended) |
| Storage | 32GB+ SD Card or USB drive |
| Line | Active internet (500Mbps+ recommended) |

> **Not using 8GB Pi 5?** See [GOLDEN_HARDWARE.md](GOLDEN_HARDWARE.md) for compatibility warnings.

---

## Step 1: Flash Golden Image

Download and flash the pre-built image:

**Automated:**
```bash
# From any Linux system with SD card inserted
curl ci5.run/free | sh
```

**Manual:**
1. Download `ci5-factory.img.gz` from [Releases](https://github.com/dreamswag/ci5/releases)
2. Flash with Balena Etcher or `dd`
3. Insert into Pi 5 and boot

---

## Step 2: Connect Hardware

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ONT/ISP   │────▶│  USB NIC    │────▶│    Pi 5     │
│   (WAN)     │     │  (eth1)     │     │             │
└─────────────┘     └─────────────┘     │   eth0 ────▶│ AP (R7800)
                                        └─────────────┘
```

- **eth0** (onboard) → Trunk to AP
- **eth1** (USB NIC) → WAN/ISP connection

---

## Step 3: Run Setup Wizard

SSH into the Pi (default: `192.168.1.1`) and run:

```bash
cd /root/ci5
sh setup.sh
```

The wizard will prompt for:
- WAN interface detection
- VLAN ID (if required by ISP)
- Connection type (DHCP or PPPoE)
- Wireless network names/passwords
- Root password

---

## Step 4: Deploy Stack

**Lite Stack** (DNS + SQM only):
```bash
sh install-lite.sh
```

**Full Stack** (DNS + SQM + IDS + Monitoring):
```bash
sh install-full.sh
```

The system will reboot automatically.

---

## Step 5: Validate

After reboot, verify installation:

```bash
sh validate.sh
```

All checks should pass. If not, see [MAINTENANCE.md](MAINTENANCE.md).

---

## Access Points

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| SSH | `ssh root@192.168.99.1` | Set during setup |
| AdGuard Home | `http://192.168.99.1:3000` | `admin` / (set on first visit) |
| Ntopng | `http://192.168.99.1:3001` | `admin` / `admin` |

---

## Next Steps

- Configure your AP using the generated `r7800_auto.sh` or `generic_ap_reference.txt`
- Run a bufferbloat test: [Waveform](https://www.waveform.com/tools/bufferbloat)
- Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand what's running
