.PHONY: build build-frontend build-backend kill clean rebuild

build: build-frontend build-backend

build-frontend:
	cd frontend && pnpm install && pnpm build

build-backend:
	go build -o jo .

kill:
	-lsof -ti:6276 | xargs kill

clean:
	rm -f jo
	rm -rf frontend/dist

rebuild: kill clean build
