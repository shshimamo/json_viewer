.PHONY: build build-frontend build-backend kill clean restart

build: build-frontend build-backend

build-frontend:
	cd frontend && pnpm install && pnpm build

build-backend:
	go build -o json_viewer .

kill:
	-lsof -ti:6276 | xargs kill

clean:
	rm -f json_viewer
	rm -rf frontend/dist

restart: kill clean build
