FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --prefer-offline 2>/dev/null || npm install
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine AS runtime
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Override main nginx config - remove 'user' directive and use /tmp for pid (writable by non-root)
RUN printf 'worker_processes auto;\nerror_log /var/log/nginx/error.log warn;\npid /tmp/nginx.pid;\nevents { worker_connections 1024; }\nhttp { include /etc/nginx/mime.types; default_type application/octet-stream; sendfile on; keepalive_timeout 65; client_body_temp_path /tmp/client_temp; proxy_temp_path /tmp/proxy_temp; fastcgi_temp_path /tmp/fastcgi_temp; uwsgi_temp_path /tmp/uwsgi_temp; scgi_temp_path /tmp/scgi_temp; include /etc/nginx/conf.d/*.conf; }\n' > /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Pre-create all nginx directories the non-root user needs to write to
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp && \
    chown -R appuser:appgroup \
             /var/cache/nginx \
             /var/log/nginx \
             /usr/share/nginx/html
# Note: pid goes to /tmp which is always writable - no chown needed

USER appuser
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
