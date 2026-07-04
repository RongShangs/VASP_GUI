.PHONY: dev dev-backend dev-frontend build deploy test clean

dev-backend:
	cd backend && python main.py

dev-frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting backend on :1691 (serves frontend if built)"
	cd backend && python main.py

dev-full:
	@echo "Building frontend then starting backend on :1691"
	cd frontend && npm run build
	cd backend && python main.py

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

install: install-backend install-frontend

build-frontend:
	cd frontend && npm run build

build:
	docker build -t vasp-gui-web .

deploy:
	docker-compose up -d

down:
	docker-compose down

test-backend:
	cd backend && python -m pytest tests/ -v

test: test-backend

clean:
	rm -rf backend/__pycache__ backend/app/__pycache__ backend/app/*/__pycache__
	rm -rf frontend/dist frontend/node_modules
