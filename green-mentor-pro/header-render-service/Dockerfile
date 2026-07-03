# Base image ships Chromium + every system dep Playwright needs — so there is no
# @sparticuz/chromium, no brotli bin to trace, no serverless cold-start extraction.
# IMPORTANT: keep this tag in lockstep with the "playwright" version in package.json.
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    # Browsers are already baked into the image at the matching version.
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.mjs ./

EXPOSE 8080
CMD ["node", "server.mjs"]
