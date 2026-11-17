# Installation

This fork does not publish prebuilt binaries. Two ways to run it: the Docker
image that GitHub builds from `main`, or a build from source.

## Docker image

Every push to `main` publishes a multi-arch image (linux/amd64, linux/arm64)
to the GitHub Container Registry:

```
docker pull ghcr.io/mfeilen/pgweb:latest
```

Each build is also tagged with its commit: `ghcr.io/mfeilen/pgweb:<sha>`.

Run it against a PostgreSQL server:

```
docker run -p 8081:8081 \
  -e PGWEB_DATABASE_URL="postgres://user:password@host:5432/database?sslmode=disable" \
  -e PGWEB_DARK_MODE=true \
  ghcr.io/mfeilen/pgweb:latest
```

The UI is then at http://localhost:8081. The image listens on port 8081 and
binds to all interfaces. For anything reachable from outside, set
`PGWEB_AUTH_USER` and `PGWEB_AUTH_PASS` as well.

### docker compose

With a `postgres` service already in your `compose.yml`:

```yaml
services:
  pgweb:
    image: ghcr.io/mfeilen/pgweb:latest
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      PGWEB_DATABASE_URL: postgres://postgres:postgres@postgres:5432/postgres?sslmode=disable
      PGWEB_DARK_MODE: "true"
    depends_on:
      - postgres
```

The official `postgres` image has no TLS enabled by default, hence
`sslmode=disable` inside the compose network.

### Container hosts (Scaleway and similar)

Point the host at `ghcr.io/mfeilen/pgweb:latest`, set the container port to
8081, and pass `PGWEB_DATABASE_URL`, `PGWEB_AUTH_USER` and `PGWEB_AUTH_PASS`
as secrets. The GitHub package must be public for a pull without credentials.

## Build from source

Go 1.27 or newer is required (`go.mod` pins the toolchain; `go` downloads it
when needed).

```
git clone https://github.com/mfeilen/pgweb.git
cd pgweb
make build
```

This produces the `pgweb` binary in the current directory. Start it with
`./pgweb`; see the [usage section](../README.md#usage) in the README for flags
and environment variables.

To build the Docker image yourself instead of pulling it:

```
docker build -t pgweb .
```

Cross-compile binaries for all supported platforms into `./bin`:

```
make release
```

## Supported platforms

- Linux amd64 and arm64 (Docker image), plus arm/v7, 386 and other targets
  via `make release`
- macOS (Intel and Apple Silicon)
- Windows 64 bit
