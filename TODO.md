# 📋 Clisonix News Platform - TODO List

**Platform**: clisonix.com/news (alias: news.clisonix.com)  
**Current Status**: Phase 1 Foundation (35% Complete)  
**Last Updated**: March 20, 2026

---

## 🟢 COMPLETED (Phase 1)

- [x] Define news as in-repo module (pillar-style, no separate repo)
- [x] Set up integrated news publishing flow in main repo
- [x] Create Newsroom Service v5.0 (200 AI labs, ethics engine, auto-publishing)
- [x] Integrate with docker-compose.yml
- [x] Write deployment documentation (NEWSROOM_DEPLOYMENT.md)
- [x] Write 90-day roadmap (NEWSROOM_90DAY_ROADMAP.md)
- [x] Fix blog visibility (795 articles now live)
- [x] Add ABA GmbH branding + footer
- [x] Create PROJECT_STATUS_REPORT.md

---

## 🔴 IN PROGRESS / BLOCKED

### CRITICAL: Hetzner Deployment
- [ ] Fix SSH connectivity to 162.125.18.133 (BLOCKED - timeout)
- [ ] SSH into Hetzner server
- [ ] `git pull origin blackboxai/fix-slo-sli-gate-errors`
- [ ] Update .env with real Facebook Page Token
- [ ] `docker compose up -d --build newsroom`
- [ ] Verify `/health` endpoint
- **Expected Timeline**: ~5 minutes once SSH works
- **Blocker**: Infrastructure access (not code-related)

### Newsroom First Publishing Cycle
- [ ] Trigger first 10 articles: `curl -X POST http://localhost:9800/publish`
- [ ] Verify articles published to blog
- [ ] Verify articles posted to Facebook
- [ ] Check audit log for 0 ethics violations
- [ ] Monitor docker logs for errors
- **Expected Timeline**: After Hetzner deployment
- **Success Criteria**: All 10 articles visible on clisonix.com/news + Facebook

### Blog API Integration Testing
- [ ] Ensure blog-api service running on port 8041
- [ ] Test endpoint: `curl http://blog-api:8041/api/publish`
- [ ] Verify article format compatibility
- [ ] Add error handling for API failures
- **Expected Timeline**: During first publish cycle

---

## 🟡 DEFERRED / NEXT PHASE

### Facebook Page Management (Hire Person for This)
- [ ] Complete Facebook Page configuration (87% pending)
- [ ] Add profile photo / cover image
- [ ] Write detailed "About" section
- [ ] Setup Contact Info (address, phone, email)
- [ ] Configure Call-to-Action button
- [ ] Add Shop/Booking functionality (if needed)
- [ ] Setup Response Time expectations
- [ ] Verify business hours
- **Decision**: User will hire someone to manage this
- **Prerequisite**: Hetzner deployment complete + first articles published
- **Documentation**: Will provide complete guide for hired person

### Facebook-Newsroom Integration
- [ ] Get real Facebook Page Token from Meta Business Suite
- [ ] Test Graph API credentials
- [ ] Configure automatic posting from Newsroom Service
- [ ] Setup article image + link preview
- [ ] Monitor posting success rate
- [ ] Setup error alerts if posting fails
- **Timeline**: Phase 2 (after Hetzner operational)
- **Note**: Person hired will manage this

---

## 📊 PHASE 2: Monetization (Days 31-60)

### Google Analytics & AdSense
- [ ] Get GA4 tracking code
- [ ] Add to index.html
- [ ] Wait 24h for data collection
- [ ] Apply for Google AdSense
- [ ] Wait for approval (~5-7 days)
- [ ] Place ads on articles
- [ ] Monitor CTR + revenue
- **Revenue Target**: $500-800/month

### Email Newsletter
- [ ] Setup Mailgun/SendGrid
- [ ] Add email signup form to index.html
- [ ] Create welcome sequence (3 emails)
- [ ] Create daily digest template
- [ ] Create sponsored article digest
- [ ] Setup automation
- **Target**: 5,000 subscribers by day 60

### Sponsorships
- [ ] Create media kit (PDF)
- [ ] Reach out to 10+ potential sponsors
- [ ] Define sponsored article format
- [ ] Setup invoicing process
- [ ] Monitor sponsorship performance
- **Revenue Target**: $1,000-1,500/month

### Subscription Tier
- [ ] Design premium content model (50% behind paywall)
- [ ] Setup Stripe integration
- [ ] Create subscriber-only email list
- [ ] Design paywall UI
- [ ] Pricing: $9.99/month or $99/year
- **Revenue Target**: $500-1,000/month

---

## 📈 PHASE 3: Scaling (Days 61-90)

### SEO & Discovery
- [ ] Generate XML sitemap
- [ ] Submit to Google News
- [ ] Create RSS feed
- [ ] Backlink outreach (50+ partners)
- [ ] Setup Google Search Console
- [ ] Monitor search rankings

### Multi-Platform Publishing
- [ ] Setup Medium.com syndication
- [ ] Setup Dev.to publishing
- [ ] Setup Twitter/X parallel posting
- [ ] Setup LinkedIn company page
- [ ] Setup WhatsApp broadcast (premium)

### Affiliate Marketing
- [ ] Setup CPA/CPL affiliate network
- [ ] Join Amazon Associates
- [ ] Add product recommendations
- [ ] Monitor affiliate revenue

### Premium Services
- [ ] Custom research reports ($500-2K each)
- [ ] API access for news data ($100/month tier)
- [ ] Branding partnership packages ($5K+)

---

## 🚀 IMMEDIATE PRIORITIES (TODAY/TOMORROW)

### TODAY (March 20)
1. **CRITICAL**: Test alternative SSH methods for Hetzner
   - [ ] Check firewall rules
   - [ ] Try web console if available
   - [ ] Verify SSH key permissions (600)
   - Get SSH working ← This unblocks everything

2. **PENDING** HETZNER DEPLOY
   - Once SSH works:
   - [ ] Pull latest code
   - [ ] Update .env with Facebook token (if available)
   - [ ] `docker compose up -d --build newsroom`
   - [ ] Verify service health

### TOMORROW (March 21)
1. **First Publishing Cycle**
   - [ ] Trigger articles: `curl -X POST http://localhost:9800/publish -d '{"posts":10}'`
   - [ ] Monitor for 30 minutes
   - [ ] Verify on clisonix.com/news (or alias news.clisonix.com)
   - [ ] Check Facebook posts
   - [ ] Zero violations?

2. **Analytics Setup**
   - [ ] Get GA4 code
   - [ ] Add to index.html
   - [ ] Commit + push to GitHub

### THIS WEEK (March 22-25)
1. **Content Monitoring**
   - [ ] 300+ articles generated
   - [ ] Monitor ethics violations
   - [ ] Check engagement metrics

2. **AdSense Application**
   - [ ] Apply to Google AdSense
   - [ ] Wait for approval

---

## 📞 BLOCKED ITEMS & RESOLUTIONS

| Item | Blocker | Status | Resolution |
|------|---------|--------|-----------|
| Hetzner Deploy | SSH timeout | 🔴 BLOCKED | Find alt access method |
| FB Publishing | Token needed | 🟡 DEFER | Get from Meta Business |
| Analytics | GA4 code needed | 🟡 DEFER | Setup after first deploy |
| AdSense | Need live articles | ⏳ PENDING | After first publish cycle |

---

## ✅ SUCCESS CRITERIA

### By End of WEEK (March 22)
- [ ] Newsroom running on Hetzner
- [ ] First 10 articles published
- [ ] 0 ethics violations
- [ ] clisonix.com/news showing articles
- [ ] GA4 tracking installed

### By End of Phase 1 (March 50)
- [ ] 300+ articles published
- [ ] 5K+ visitors
- [ ] 99.5% uptime
- [ ] 100% ethics compliance

### By End of Phase 2 (April 19)
- [ ] $2.5K/month revenue
- [ ] 5K email subscribers
- [ ] 20 sponsored articles

### By End of Phase 3 (May 19)
- [ ] $11K+/month revenue
- [ ] 50K visitors/month
- [ ] Top 100K global website

---

## 👥 TEAM ROLES

| Role | Status | Responsibility |
|------|--------|-----------------|
| **You** | Active | Deploy Newsroom, Launch platform |
| **Hired FB Person** (Future) | TBD | Manage Facebook page + posting |
| **Analytics** | TBD | GA4 + revenue tracking |
| **Content** | TBD | Sponsor management (Phase 2) |

---

## 📁 KEY DOCUMENTATION

- [NEWSROOM_DEPLOYMENT.md](NEWSROOM_DEPLOYMENT.md) - How to deploy
- [NEWSROOM_90DAY_ROADMAP.md](NEWSROOM_90DAY_ROADMAP.md) - Strategic plan
- [PROJECT_STATUS_REPORT.md](PROJECT_STATUS_REPORT.md) - Session summary
- [services/newsroom/main.py](services/newsroom/main.py) - Service code

---

**Last Action**: Fixed blog (795 articles) + created Newsroom Service v5.0 + documented everything  
**Next Action**: Deploy to Hetzner ← SSH access needed  
**Status**: 🟢 Ready to deploy (waiting on infrastructure access)

