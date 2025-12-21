# 🏗️ Ci5 Architecture

## Design Philosophy

Ci5 separates network infrastructure into two distinct planes:

1. **Fast Path** (Kernel) — Routing, NAT, SQM/CAKE, BBR, Unbound
2. **Smart Path** (Docker) — IDS, IPS, Traffic Analysis, Ad Blocking

This hybrid model ensures **network connectivity survives container failures**.

---

## Terminology

**Corks** are Docker containers. This is Ci5 nomenclature for sandboxed applications that run in the Pi 5's "Leeway" RAM — memory not required for core routing functions. The term is used exclusively throughout this documentation after this definition.

---

## The Hybrid Control Plane

| Path | Execution Context | Components | Crash Impact |
|------|-------------------|------------|--------------|
| **Fast Path** | Bare metal kernel | Routing, NAT, CAKE, BBR, Unbound | N/A (kernel) |
| **Smart Path** | Isolated Docker | Suricata, CrowdSec, Ntopng, AdGuard | Internet stays up |

If Docker dies, you lose visibility and filtering — but packets still flow.

---

## Domain Architecture

Ci5 spans five domains with distinct responsibilities:

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                     │
│                           │                                      │
│                     curl ci5.run/free                            │
│                           │                                      │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    ci5.run                               │   │
│   │              (Entry Point / Router)                      │   │
│   │         Redirects to appropriate scripts                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           │                                      │
│           ┌───────────────┼───────────────┐                      │
│           ▼               ▼               ▼                      │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│   │    ci5      │ │  ci5.host   │ │  ci5.dev    │               │
│   │ (Core Repo) │ │  (Auditor)  │ │ (Registry)  │               │
│   │ Scripts +   │ │  Overlay    │ │  Cork DB    │               │
│   │ Configs     │ │  Sandbox    │ │  + Metadata │               │
│   └─────────────┘ └─────────────┘ └─────────────┘               │
│           │               │               │                      │
│           └───────────────┼───────────────┘                      │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  ci5.network                             │   │
│   │            (Documentation Hub)                           │   │
│   │        Central source of truth                           │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Network Topology

```
                    INTERNET
                        │
                        ▼
              ┌─────────────────┐
              │   ISP ONT/Modem │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   USB NIC (eth1)│  ← WAN Interface
              │   RTL8153       │
              └────────┬────────┘
                       │
        ┌──────────────┴──────────────┐
        │      RASPBERRY PI 5         │
        │                             │
        │  ┌───────────────────────┐  │
        │  │    FAST PATH          │  │
        │  │  ┌─────┐ ┌─────────┐  │  │
        │  │  │ NAT │ │  CAKE   │  │  │
        │  │  │     │ │  SQM    │  │  │
        │  │  └─────┘ └─────────┘  │  │
        │  │  ┌─────┐ ┌─────────┐  │  │
        │  │  │ BBR │ │ Unbound │  │  │
        │  │  └─────┘ └─────────┘  │  │
        │  └───────────────────────┘  │
        │                             │
        │  ┌───────────────────────┐  │
        │  │    SMART PATH         │  │
        │  │  ┌─────────┐          │  │
        │  │  │ Docker  │          │  │
        │  │  │┌───────┐│          │  │
        │  │  ││Suricat││          │  │
        │  │  │└───────┘│          │  │
        │  │  │┌───────┐│          │  │
        │  │  ││AdGuard││          │  │
        │  │  │└───────┘│          │  │
        │  │  │┌───────┐│          │  │
        │  │  ││Ntopng ││          │  │
        │  │  │└───────┘│          │  │
        │  │  └─────────┘          │  │
        │  └───────────────────────┘  │
        │                             │
        └──────────────┬──────────────┘
                       │
              ┌────────┴────────┐
              │  Onboard (eth0) │  ← TRUNK
              │  VLAN Tagged    │
              └────────┬────────┘
                       │
              ┌────────┴────────┐
              │     AP (R7800)  │
              │  ┌───────────┐  │
              │  │ VLAN 10   │──┼──▶ Trusted WiFi
              │  │ VLAN 20   │──┼──▶ Work WiFi
              │  │ VLAN 30   │──┼──▶ IoT WiFi (Isolated)
              │  │ VLAN 40   │──┼──▶ Guest WiFi (Isolated)
              │  └───────────┘  │
              └─────────────────┘
```

---

## VLAN Segmentation

| VLAN | Subnet | Zone | Purpose |
|------|--------|------|---------|
| 1 | 192.168.99.0/24 | lan | Management / Untagged |
| 10 | 10.10.10.0/24 | lan | Trusted devices |
| 20 | 10.10.20.0/24 | lan | Work devices |
| 30 | 10.10.30.0/24 | iot | IoT (no inter-VLAN) |
| 40 | 10.10.40.0/24 | guest | Guests (no inter-VLAN) |

---

## Cork Stack

### Core Corks (Always Running)

| Cork | Purpose | RAM |
|------|---------|-----|
| AdGuard Home | DNS filtering | ~128MB |
| Unbound | Recursive resolver | ~64MB |

### Full Stack Corks (Optional)

| Cork | Purpose | RAM | Profile |
|------|---------|-----|---------|
| Suricata | IDS (packet inspection) | ~512MB | `full` |
| CrowdSec | IPS (threat intelligence) | ~128MB | `full` |
| Ntopng | Traffic analysis | ~256MB | `full` |
| Redis | Data store for Ntopng | ~64MB | `full` |

### Community Corks (Registry)

See [ci5.dev/corks.json](https://ci5.dev/corks.json) for available community modules.

---

## DNS Resolution Chain

```
Client Device
     │
     ▼
AdGuard Home (:53)     ← Filtering/Blocking
     │
     ▼
Unbound (:5335)        ← Recursive Resolution
     │
     ▼
Root Servers           ← Authoritative DNS
```

**Failover:** If AdGuard fails, the DNS Failover Watchdog promotes Unbound to port 53.

---

## SQM/CAKE Configuration

CAKE (Common Applications Kept Enhanced) provides:
- **Bandwidth shaping** at 95% of measured line speed
- **Per-flow queuing** for fairness
- **Latency control** via FQ-CoDel

```bash
# Verify CAKE is active
tc qdisc show dev eth1 | grep cake
```

---

## Appendix A: Advanced Security Options

### YubiKey / FIDO2 SSH Authentication

For hardware-based SSH authentication:

1. Install packages:
   ```bash
   opkg install openssh-server libfido2
   ```

2. Configure SSHD (`/etc/ssh/sshd_config`):
   ```
   PubkeyAuthentication yes
   AuthenticationMethods publickey
   SecurityKeyProvider /usr/libexec/ssh-sk-helper
   ```

3. Enroll key (from client PC):
   ```bash
   ssh-keygen -t ed25519-sk -f ~/.ssh/id_fido_pi5
   ```

4. Deploy public key to `/root/.ssh/authorized_keys`

### Paranoia Watchdog

Optional script that kills WAN if Suricata stops running:

```bash
# Enable paranoia mode
sh /root/ci5/extras/paranoia_watchdog.sh &
```

**Warning:** This will disconnect your network if IDS fails.

---

## Appendix B: Firewall Zone Matrix

| Source → Dest | wan | lan | iot | guest | docker |
|---------------|-----|-----|-----|-------|--------|
| **wan** | — | REJECT | REJECT | REJECT | REJECT |
| **lan** | ACCEPT | ACCEPT | ACCEPT | ACCEPT | ACCEPT |
| **iot** | ACCEPT | REJECT | — | REJECT | REJECT |
| **guest** | ACCEPT | REJECT | REJECT | — | REJECT |
| **docker** | ACCEPT | DNS only | REJECT | REJECT | — |
