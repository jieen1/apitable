/**
 * APITable <https://github.com/apitable/apitable>
 * Copyright (C) 2022 APITable Ltd. <https://apitable.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
const express = require('express');
const next = require('next');
const { createProxyMiddleware } = require('http-proxy-middleware');
const port = parseInt(process.env.WEB_SERVER_PORT, 10) || 3000;
const isDevelopment = process.env.NODE_ENV !== 'production';

const portfinder = require('portfinder');

portfinder.setBasePort(port);
portfinder.setHighestPort(3333);

portfinder
  .getPortPromise()
  .then((port) => {
    const app = next({ dev: isDevelopment, port, hostname: 'localhost' });
    const handle = app.getRequestHandler();

    app
      .prepare()
      .then(() => {
        const server = express();

        if (isDevelopment) {
          const databusTarget = process.env.API_PROXY || 'http://127.0.0.1:8082';
          const nestTarget = process.env.API_PROXY || process.env.API_ROOM_SERVER || 'http://127.0.0.1:3333';
          const apiTarget = process.env.API_PROXY || process.env.API_BACKEND_SERVER || 'http://127.0.0.1:8081';
          const fusionTarget = process.env.API_PROXY || process.env.API_FUSION_SERVER || 'http://127.0.0.1:3333';
          const documentTarget = process.env.API_PROXY || process.env.API_SOCKET_SERVER_DOCUMENT || 'http://127.0.0.1:3006';
          const roomTarget = process.env.API_PROXY || process.env.API_SOCKET_SERVER_ROOM || 'http://127.0.0.1:3005';
          const notificationTarget = process.env.API_PROXY || process.env.API_SOCKET_SERVER_NOTIFICATION || 'http://127.0.0.1:3002';

          if (!databusTarget || !nestTarget || !apiTarget || !fusionTarget || !documentTarget || !roomTarget || !notificationTarget) {
            console.warn('Warning: Some API proxy targets are not configured. Please set environment variables:');
            console.warn('- API_PROXY');
            console.warn('- API_ROOM_SERVER');
            console.warn('- API_BACKEND_SERVER');
            console.warn('- API_FUSION_SERVER');
            console.warn('- API_SOCKET_SERVER_DOCUMENT');
            console.warn('- API_SOCKET_SERVER_ROOM');
            console.warn('- API_SOCKET_SERVER_NOTIFICATION');
          }

          server.use(
            '/databus',
            createProxyMiddleware({
              target: databusTarget,
              changeOrigin: true,
              cookieDomainRewrite: '',
            }),
          );

          server.use(
            '/nest',
            createProxyMiddleware({
              target: nestTarget,
              changeOrigin: true,
              cookieDomainRewrite: '',
            }),
          );

          server.use(
            '/api',
            createProxyMiddleware({
              target: apiTarget,
              changeOrigin: true,
              cookieDomainRewrite: '',
            }),
          );

          server.use(
            '/fusion',
            createProxyMiddleware({
              target: fusionTarget,
              changeOrigin: true,
              cookieDomainRewrite: '',
            }),
          );

          server.use(
            '/document',
            createProxyMiddleware({
              target: documentTarget,
              ws: true,
              changeOrigin: true,
              cookieDomainRewrite: '',
            }),
          );

          server.use(
            '/room',
            createProxyMiddleware({
              target: roomTarget,
              ws: true,
              changeOrigin: true,
              cookieDomainRewrite: '',
            }),
          );

          server.use(
            '/notification',
            createProxyMiddleware({
              target: notificationTarget,
              ws: true,
              changeOrigin: true,
              cookieDomainRewrite: '',
            }),
          );
        }

        server.all('/*path', (req, res) => {
          return handle(req, res);
        });

        server.listen(port, () => {
          console.log(`> Ready on http://localhost:${port}`);
        });
      })
      .catch((e) => {
        console.log(e);
      });
  })
  .catch((err) => {
    console.log(err);
  });
