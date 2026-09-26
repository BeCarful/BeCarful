# BeCarful

Mobile-first, AI-powered car insurance companion: photograph damage, see it mapped onto your car, understand your policy, chat about your vehicle, and follow a to-do list to a verified claim link.

Next.js 16 · TypeScript · Tailwind v4 · MongoDB/Mongoose · AWS S3 · Gemini

```bash
npm install
cp .env.example .env.local   # fill in Mongo, S3, Gemini, AUTH_SECRET
npm run seed                 # demo@becarful.app / demo1234
npm run dev
```

The S3 bucket needs CORS allowing `POST` from your app origin (uploads go straight to S3). See `AGENTS.md` for the full spec, architecture and commands.

Tuxemon sprite credits: `public/tuxemon/ATTRIBUTION.md`.
