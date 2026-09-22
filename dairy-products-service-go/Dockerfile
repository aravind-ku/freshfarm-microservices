# ---------- Build Stage ----------
FROM golang:1.27-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY main.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -o dairy-service .

# ---------- Runtime Stage ----------
FROM alpine:3.22

WORKDIR /app

COPY --from=builder /app/dairy-service .

EXPOSE 5004

CMD ["./dairy-service"]