# BeCarful

Mobile-first, AI-powered car insurance companion: photograph damage, see it mapped onto your car, understand your policy, chat about your vehicle, and follow a to-do list to a verified claim link.

Next.js 16 · TypeScript · Tailwind v4 · MongoDB/Mongoose · Google Cloud Storage · Gemini on Vertex AI

```bash
npm install
cp .env.example .env.local   # fill in Mongo, AUTH_SECRET, Google Cloud project + bucket
npm run seed                 # demo@becarful.app / demo1234
npm run dev
```

The Cloud Storage bucket needs CORS allowing `POST` from your app origin (uploads go straight to the bucket). See `AGENTS.md` for the full spec, architecture and commands.

Tuxemon sprite credits: `public/tuxemon/ATTRIBUTION.md`.
