# Debian-based image: sharp, ffmpeg-static and @imgly/background-removal-node
# all ship glibc prebuilds. Alpine/musl would need extra work  avoid it here.
FROM node:20-bookworm-slim

# sharp's prebuilt binary needs libstdc++/libc (present on bookworm-slim already),
# but ca-certificates is needed for the ONNX model + API HTTPS calls at runtime.
# fontconfig + fonts-liberation give sharp/librsvg a real font to render captions
# with (the SVG asks for "Liberation Sans", an Arial metric-compatible family);
# without these the caption layer renders empty and logs a Fontconfig error.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates \
       fontconfig \
       fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for better layer caching. ffmpeg-static/ffprobe-static and
# the background-removal model are fetched here for the linux/x64 target.
COPY package*.json ./
RUN npm ci --omit=dev

# App source + audio assets (assets/audio/*.mp3 must be in the image).
COPY . .

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
