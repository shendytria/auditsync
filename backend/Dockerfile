# ===== STAGE 1: BUILDER =====
FROM golang:1.25-alpine AS builder

WORKDIR /app

# install git + certs (WAJIB untuk go mod)
RUN apk add --no-cache git ca-certificates

# FIX Go network
ENV GOPROXY=https://proxy.golang.org,direct
ENV GOSUMDB=sum.golang.org
ENV CGO_ENABLED=0

COPY go.mod go.sum ./

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download -x


COPY . .

RUN GOOS=linux GOARCH=amd64 go build -o app


# ===== STAGE 2: RUNTIME =====
FROM alpine:3.19

WORKDIR /app

RUN apk add --no-cache ca-certificates

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/app .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080
CMD ["./app"]
