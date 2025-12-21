# 🔧 Maintenance & Recovery

## Philosophy: State-Capture and Re-Flash

Ci5 is designed around **disposable infrastructure**. Instead of debugging complex issues:

1. Capture your configuration state
2. Re-flash the golden image
3. Restore configuration
4. Return to known-good state

This approach takes 10 minutes vs. hours of debugging.

---

## Diagnostic Tools

| Tool | Purpose | Command |
|------|---------|---------|
| `validate.sh` | Health check | `sh /root/ci5/validate.sh` |
| `bone_marrow.sh` | Full system dump | `sh /root/ci5/bone_marrow.sh` |
| `speed_wizard.sh` | SQM auto-tune | `sh /root/ci5/extras/speed_wizard.sh` |

### Generate Diagnostic Report

```bash
ssh root@192.168.99.1
sh /root/ci5/bone_marrow.sh
```

Output: `hostname_bone_marrow_TIMESTAMP.md`

Export to PC:

```bash
scp root@192.168.99.1:/root/*_bone_marrow_*.md ./
```

---

## Update Procedures

### Update Cork Registry

```bash
curl ci5.run/ward | sh
```

### Update Core Stack

```bash
cd /opt/ci5
git pull
sh install-lite.sh  # or install-full.sh
```

### Update Suricata Rules

Rules update automatically via CrowdSec and ET Open. Manual update:

```bash
docker exec suricata suricata-update
docker restart suricata
```

---

## Common Issues

### Bufferbloat Not A+

1. Run `speed_wizard.sh` — SQM limits must match line speed
2. Verify offloads disabled:
   ```bash
   ethtool -k eth1 | grep offload
   ```
3. Verify CAKE active:
   ```bash
   tc qdisc show dev eth1 | grep cake
   ```
4. Check for PPPoE double-shaping:
   ```bash
   tc qdisc show dev pppoe-wan
   ```

### Docker Containers Won't Start

1. Check Docker status:
   ```bash
   /etc/init.d/dockerd status
   ```
2. Check disk space:
   ```bash
   df -h
   ```
3. Check logs:
   ```bash
   docker logs container-name
   ```

### DNS Not Working

1. Verify Unbound:
   ```bash
   pgrep unbound
   ```
2. Verify AdGuard:
   ```bash
   docker ps | grep adguard
   ```
3. Check port conflicts:
   ```bash
   netstat -tlnp | grep ':53'
   ```

### Locked Out (Can't SSH)

Clear old host keys:

```bash
ssh-keygen -f "$HOME/.ssh/known_hosts" -R "192.168.99.1"
```

---

## Recovery Procedures

### Emergency Recovery Mode

If you have physical access:

```bash
sh /root/ci5/extras/emergency_recovery.sh
```

This creates fallback IPs (192.168.1.1, 192.168.88.1) and starts emergency DHCP.

### Factory Reset

```bash
firstboot -y && reboot
```

This wipes UCI config and restores OpenWrt defaults.

### Full Re-Flash

1. Power off Pi
2. Remove storage media
3. Flash fresh ci5-factory.img
4. Re-run setup wizard
5. Back to baseline in 10 minutes

---

## AI-Assisted Troubleshooting

For complex issues:

1. Generate `bone_marrow.sh` report
2. Upload report to Claude or Gemini
3. Provide the full Ci5 repository context
4. Describe issue with exact error messages
5. Follow recommendations iteratively

This is the same workflow the project creator uses.

---

## Partial Uninstallation

To remove specific components:

```bash
sh /root/ci5/extras/uninstallers/partial-uninstall.sh
```

Interactive TUI for selective removal of:
- Docker containers
- Unbound
- DNS Failover Watchdog
- Paranoia Watchdog
- Full factory reset option

---

## Validation Checklist

Run after any maintenance:

```bash
sh /root/ci5/validate.sh
```

Expected output (all green):

```
[1/10] VLANs (10/20/30/40)... ✓
[2/10] SQM (CAKE on eth1)... ✓
[3/10] PPPoE qdisc guard... ✓ No double shaping
[4/10] Offloads disabled... ✓
[5/10] Unbound (port 5335)... ✓
[6/10] Docker stack... ✓ (5 containers)
[7/10] ntopng image... ✓
[8/10] DNS Failover watchdog... ✓ Running
[9/10] Docker DNS config... ✓ Local DNS only
[10/10] Internet connectivity... ✓
==========================================
   ✅ ALL CHECKS PASSED
==========================================
```

If any check fails, address it before proceeding.
