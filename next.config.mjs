/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Socket.IO server is attached to a custom HTTP server (see server/index.ts),
  // so no rewrites are needed here. Next handles all non-socket.io routes.
};

export default nextConfig;
