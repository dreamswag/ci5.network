# 🆘 Support Policy

## Status: "Works on My Machine" Ware

Ci5 is a reference implementation, not a managed product. It works on the Golden Hardware Stack. Deviations are unsupported.

---

## Before Asking for Help

### Pre-Submission Checklist

- [ ] Running Golden Hardware Stack? (8GB Pi 5, RTL8153 NIC, VLAN-capable AP)
- [ ] Read relevant documentation?
- [ ] Ran `validate.sh`?
- [ ] Generated `bone_marrow.sh` report?
- [ ] Searched existing GitHub issues?
- [ ] Tried AI-assisted troubleshooting?
- [ ] Tested on fresh flash?

If you answered "no" to any of these, resolve them before proceeding.

---

## Valid Support Requests

| Type | Example | Outcome |
|------|---------|---------|
| Syntax error | Line 42 of `install-lite.sh` has typo | PR accepted |
| Security vulnerability | Private disclosure | Reviewed |
| Documentation error | Incorrect command in docs | PR accepted |

---

## Invalid Support Requests

| Type | Example | Outcome |
|------|---------|---------|
| "Doesn't work" | No details | Ignored |
| Pi 4 issues | Any | Unsupported |
| 4GB OOM | Full stack on 4GB | Expected behavior |
| ISP-specific | "My ISP uses weird VLANs" | Your problem |
| User modification | "I changed X, now Y broke" | You broke it |
| Missing `bone_marrow.sh` | Issue without diagnostics | Incomplete |

---

## Community Resources

### GitHub Discussions

| Category | Purpose |
|----------|---------|
| [INTEL_REQ](https://github.com/dreamswag/ci5.network/discussions/categories/intel_req) | Troubleshooting questions |
| [ARMORY](https://github.com/dreamswag/ci5.network/discussions/categories/armory) | Hardware showcase |
| [METRICS](https://github.com/dreamswag/ci5.network/discussions/categories/metrics) | Performance benchmarks |

### External Communities

- r/openwrt
- r/homelab
- r/networking

---

## The Labor Tax

This project is free. Your time is the cost.

| Traditional Expectation | Ci5 Reality |
|-------------------------|-------------|
| Free software + free support | Free software + your effort |
| Maintainer debugs your setup | AI + you debug your setup |
| Pay with donations | Pay with labor |
| Passive consumption | Active learning |

---

## Self-Service Troubleshooting Protocol

### Step 1: Generate Diagnostics

```bash
ssh root@192.168.99.1
sh /root/ci5/bone_marrow.sh
```

### Step 2: Export Report

```bash
scp root@192.168.99.1:/root/*_bone_marrow_*.md ./
```

### Step 3: Consult AI

1. Open [Claude](https://claude.ai) or [Gemini](https://gemini.google.com)
2. Upload/import the Ci5 repository
3. Attach your `bone_marrow_report.md`
4. Describe problem with explicit detail:
   - What you expected
   - What actually happened
   - What you already tried
   - Exact error messages

### Step 4: Iterate

| Outcome | Action |
|---------|--------|
| Fixed | Document for yourself |
| Persists | New `bone_marrow.sh`, repeat Step 3 |
| Bricked | Re-flash (10 minutes) |
| Exhausted | Post to Reddit with full context |

---

## Philosophy

**Why no support?**
- Built for one hardware stack
- Can't debug hardware I don't own
- AI exists for troubleshooting
- Learning has value

**Why share at all?**
- Open source is how we got here
- Vendor lock-in is bullshit
- £130 shouldn't beat £500
- Maybe you'll build something better

---

## What I Owe You

Nothing.

## What You Owe Me

Nothing.

## What You Owe Yourself

The effort to learn, or the honesty to admit this isn't for you.

---

## License

MIT. Do whatever you want. Attribution appreciated but not required.

---

## Contact

**For security vulnerabilities:** Open a private security advisory on GitHub.

**For everything else:** Don't.
