# 🎯 Golden Hardware Stack

Ci5 is built, tested, and validated exclusively on the following configuration. Deviations are at your own risk.

---

## Guaranteed Configuration

| Component | Model | Notes |
|-----------|-------|-------|
| **Compute** | Raspberry Pi 5 (8GB) | **Non-negotiable** |
| **WAN NIC** | USB 3.0 Gigabit (RTL8153) | eth1 interface |
| **LAN** | Onboard Ethernet (eth0) | Trunk to AP |
| **AP** | Netgear R7800 (OpenWrt) | Auto-config provided |
| **Storage** | High Endurance SD / USB SSD | SD works; NVMe optimal |
| **PSU** | Official Pi 5 27W USB-C | Undervoltage = instability |

---

## ⚠️ Hardware Warnings

### Raspberry Pi 5 (4GB) — Community Supported

The 4GB model can run the **Lite Stack** comfortably. Full Stack is risky:

| Scenario | 4GB Outcome |
|----------|-------------|
| Lite Stack only | ✅ Fine |
| Full Stack, idle | ⚠️ Marginal |
| Full Stack + load test | ❌ OOM risk |
| Full Stack + Suricata rule update | ❌ OOM likely |

**Recommendation:** If you own a 4GB, run Lite only. If buying new, spend the extra £15 for 8GB.

### Raspberry Pi 4 — Unsupported

The Pi 4's Cortex-A72 cannot achieve Ci5's documented performance:

| Metric | Pi 4 | Pi 5 |
|--------|------|------|
| Single-thread IPC | Baseline | +50% |
| CAKE + IDS headroom | Insufficient | Comfortable |
| Bufferbloat at load | Degrades | +0ms sustained |

**Do not open issues for Pi 4 problems.** It will not work.

---

## USB NIC Compatibility

**Validated:**
- RTL8153 (most common)

**Likely Compatible:**
- AX88179
- AQC111U (2.5G HATs)

**Not Recommended:**
- RTL8152 (100Mbps - wrong chip)
- Unbranded Amazon specials

Verify your NIC:
```bash
lsusb | grep -i ethernet
dmesg | grep eth1
```

---

## Access Point Requirements

Your AP must support **802.1Q VLAN tagging** to use Ci5's network segmentation.

**Known Compatible:**
- Netgear R7800 (OpenWrt) — Reference AP, auto-config included
- UniFi APs (controller-managed)
- Omada APs (controller-managed)
- Any OpenWrt-capable router in AP mode

**Not Compatible:**
- ISP-provided routers (usually)
- Stock firmware consumer routers
- Mesh systems without Ethernet backhaul

If your AP can't assign VLANs to SSIDs, you'll have a flat network (reduced security).

---

## The "Leeway" Concept

The Pi 5 (8GB) provides approximately **6-7GB of RAM** beyond what routing requires. This "Leeway" is available for Corks (containerized applications).

```
┌──────────────────────────────────────────────────┐
│               8GB Total RAM                       │
├──────────────┬───────────────────────────────────┤
│  ~1.5GB      │          ~6.5GB "Leeway"          │
│  Core Stack  │      Available for Corks          │
│  (Routing)   │  (Ntopng, Home Assistant, etc.)   │
└──────────────┴───────────────────────────────────┘
```

On 4GB models, Leeway shrinks to ~2.5GB — severely limiting Cork options.
