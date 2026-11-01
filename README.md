# Swipewise

**App:** https://swipewise-app.github.io/ (installable web app; each person's setup and likes are saved on their own phone)

## Menu feed

A daily feed of UT Austin dining hall menus (J2, Kins and JCL), with nutrition for each item, for the Swipewise app.

- **Feed:** `docs/menu.json`, also served by GitHub Pages at `https://swipewise-app.github.io/menu.json`
- **Refresh:** `.github/workflows/refresh-menu.yml` runs every day at about 3–4 AM Central. It commits only when the menu changed.
- **Safety:** if UT's site is down or the data looks wrong (fewer than 5 days, a missing J2 or Kins, or 300 or fewer recipes), the run fails and the last good menu stays in place. GitHub emails you about a failed run.
- **Run it by hand:** Actions tab → "Refresh UT dining menus" → Run workflow.
- **Run it locally:** `node scripts/scrape.mjs docs/menu.json` (Node 20+, no installs needed)

Format: `{updated, semester, hours, days: {"MM/DD/YYYY": {hall: {meal: [[station, recipeId], ...]}}}, rec: {recipeId: [name, portion, legends, cal, protein, carb, fat, fiber, sugar, sodium]}}`

Source: UT Housing & Dining FoodPro, https://hf-foodpro.austin.utexas.edu/foodpro/
