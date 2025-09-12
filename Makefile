# Finance Tracker - Beautiful Docker Management
# Modern Node.js + C++ Microservices Architecture

.PHONY: help setup up down restart clean logs health test

# Configuration
PROJECT_NAME := finance-tracker
COMPOSE_FILE := docker-compose.yml
ENV_FILE := .env

# Service groups
NODE_SERVICES := gateway auth expense income category
CPP_ENGINES := analytics-engine reporting-engine ml-engine  
INFRASTRUCTURE := postgres redis rabbitmq
ALL_SERVICES := $(INFRASTRUCTURE) $(NODE_SERVICES) $(CPP_ENGINES)

# Colors for beautiful output
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
PURPLE := \033[35m
CYAN := \033[36m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

#============================================================================
# 🌟 MAIN COMMANDS
#============================================================================

help: ## Show this beautiful help menu
	@echo ""
	@echo "${BLUE}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
	@echo "${BLUE}║                    🚀 Finance Tracker - Docker Manager                    ║${NC}"
	@echo "${BLUE}║                     Node.js APIs + C++ Performance Engines               ║${NC}"
	@echo "${BLUE}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
	@echo ""
	@echo "${GREEN}🚀 QUICK START:${NC}"
	@echo "  ${CYAN}make setup${NC}          Complete project setup (first time)"
	@echo "  ${CYAN}make dev${NC}            Development mode (build + logs)"
	@echo "  ${CYAN}make up${NC}             Start all services"
	@echo "  ${CYAN}make down${NC}           Stop all services"
	@echo ""
	@echo "${GREEN}🔧 DEVELOPMENT:${NC}"
	@echo "  ${CYAN}make build-node${NC}     Build all Node.js services"
	@echo "  ${CYAN}make build-cpp${NC}      Build all C++ engines"
	@echo "  ${CYAN}make restart-node${NC}   Restart Node.js services only"
	@echo "  ${CYAN}make restart-cpp${NC}    Restart C++ engines only"
	@echo ""
	@echo "${GREEN}📊 MONITORING:${NC}"
	@echo "  ${CYAN}make logs${NC}           Follow all service logs"
	@echo "  ${CYAN}make health${NC}         Check all service health"
	@echo "  ${CYAN}make status${NC}         Show container status"
	@echo "  ${CYAN}make test${NC}           Run health tests"
	@echo ""
	@echo "${GREEN}🧹 CLEANUP:${NC}"
	@echo "  ${CYAN}make clean${NC}          Remove containers"
	@echo "  ${CYAN}make reset${NC}          Complete reset (nuclear option)"
	@echo ""
	@echo "${GREEN}🔍 SERVICE SPECIFIC:${NC}"
	@echo "  ${CYAN}make logs-[service]${NC} Show specific service logs"
	@echo "  ${CYAN}make shell-[service]${NC} Access service shell"
	@echo "  ${CYAN}make build-[service]${NC} Build specific service"
	@echo ""

setup: ## 🚀 Complete project setup (first time)
	@echo "${BLUE}🚀 Setting up Finance Tracker...${NC}"
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "${YELLOW}📝 Creating .env file...${NC}"; \
		cp .env.example $(ENV_FILE) 2>/dev/null || echo "# Created by setup" > $(ENV_FILE); \
		echo "${GREEN}✅ .env file created${NC}"; \
		echo "${RED}⚠️  Please update passwords in .env file!${NC}"; \
		read -p "Press Enter after updating .env..."; \
	fi
	@echo "${BLUE}🔨 Building all services...${NC}"
	@$(MAKE) build-all
	@echo "${BLUE}🚀 Starting services...${NC}"
	@$(MAKE) up
	@sleep 5
	@$(MAKE) show-urls
	@echo "${GREEN}🎉 Setup complete!${NC}"

#============================================================================
# 🏗️ BUILD COMMANDS
#============================================================================

build-all: build-node build-cpp ## Build all services

build-node: ## Build all Node.js services
	@echo "${BLUE}🔨 Building Node.js services...${NC}"
	@for service in $(NODE_SERVICES); do \
		echo "${CYAN}  Building $$service...${NC}"; \
		docker-compose build $$service || (echo "${RED}❌ $$service build failed${NC}" && exit 1); \
	done
	@echo "${GREEN}✅ All Node.js services built${NC}"

build-cpp: ## Build all C++ engines
	@echo "${BLUE}🔨 Building C++ engines...${NC}"
	@for engine in $(CPP_ENGINES); do \
		echo "${CYAN}  Building $$engine...${NC}"; \
		docker-compose build $$engine || (echo "${RED}❌ $$engine build failed${NC}" && exit 1); \
	done
	@echo "${GREEN}✅ All C++ engines built${NC}"

# Individual service builds
$(addprefix build-,$(ALL_SERVICES)): build-%:
	@echo "${BLUE}🔨 Building $*...${NC}"
	@docker-compose build --no-cache $* || (echo "${RED}❌ $* build failed${NC}" && exit 1)
	@echo "${GREEN}✅ $* built successfully${NC}"

#============================================================================
# 🚀 LIFECYCLE COMMANDS
#============================================================================

up: | check-env ## Start all services
	@echo "${BLUE}🚀 Starting Finance Tracker...${NC}"
	@docker-compose up -d
	@sleep 3
	@$(MAKE) status
	@$(MAKE) show-urls

down: ## Stop all services
	@echo "${BLUE}🛑 Stopping all services...${NC}"
	@docker-compose down
	@echo "${GREEN}✅ All services stopped${NC}"

restart: ## Restart all services
	@echo "${BLUE}♻️  Restarting all services...${NC}"
	@docker-compose restart
	@echo "${GREEN}✅ All services restarted${NC}"

restart-node: ## Restart only Node.js services
	@echo "${BLUE}♻️  Restarting Node.js services...${NC}"
	@for service in $(NODE_SERVICES); do \
		echo "${CYAN}  Restarting $$service...${NC}"; \
		docker-compose restart $$service; \
	done
	@echo "${GREEN}✅ Node.js services restarted${NC}"

restart-cpp: ## Restart only C++ engines
	@echo "${BLUE}♻️  Restarting C++ engines...${NC}"
	@for engine in $(CPP_ENGINES); do \
		echo "${CYAN}  Restarting $$engine...${NC}"; \
		docker-compose restart $$engine; \
	done
	@echo "${GREEN}✅ C++ engines restarted${NC}"

dev: ## Development mode (build + logs)
	@echo "${BLUE}🔧 Starting development mode...${NC}"
	@$(MAKE) build-all
	@$(MAKE) up
	@echo "${YELLOW}📋 Following logs (Ctrl+C to exit)...${NC}"
	@$(MAKE) logs

#============================================================================
# 📊 MONITORING COMMANDS
#============================================================================

status: ## Show container status
	@echo "${BLUE}📊 Container Status:${NC}"
	@docker-compose ps

health: ## Check all service health
	@echo "${BLUE}🏥 Health Check Results:${NC}"
	@echo ""
	@echo "${CYAN}Infrastructure:${NC}"
	@docker-compose ps postgres redis rabbitmq --format table
	@echo ""
	@echo "${CYAN}Node.js Services:${NC}"
	@for service in $(NODE_SERVICES); do \
		port=$$(docker-compose port $$service 3000 2>/dev/null | cut -d: -f2); \
		if [ "$$port" ]; then \
			if curl -sf http://localhost:$$port/health >/dev/null 2>&1; then \
				echo "${GREEN}✅ $$service (port $$port)${NC}"; \
			else \
				echo "${RED}❌ $$service (port $$port)${NC}"; \
			fi; \
		else \
			echo "${YELLOW}⏸️  $$service (not running)${NC}"; \
		fi; \
	done
	@echo ""
	@echo "${CYAN}C++ Engines:${NC}"
	@for engine in $(CPP_ENGINES); do \
		port=$$(docker-compose port $$engine 8080 2>/dev/null | cut -d: -f2); \
		if [ "$$port" ]; then \
			if curl -sf http://localhost:$$port/health >/dev/null 2>&1; then \
				echo "${GREEN}✅ $$engine (port $$port)${NC}"; \
			else \
				echo "${RED}❌ $$engine (port $$port)${NC}"; \
			fi; \
		else \
			echo "${YELLOW}⏸️  $$engine (not running)${NC}"; \
		fi; \
	done

logs: ## Follow all logs
	@echo "${BLUE}📋 Following all logs (Ctrl+C to exit)...${NC}"
	@docker-compose logs -f

$(addprefix logs-,$(ALL_SERVICES)): logs-%:
	@echo "${BLUE}📋 Following $* logs (Ctrl+C to exit)...${NC}"
	@docker-compose logs -f $*

test: ## Run service tests
	@echo "${BLUE}🧪 Running service tests...${NC}"
	@$(MAKE) health

#============================================================================
# 🔧 UTILITY COMMANDS
#============================================================================

$(addprefix shell-,$(ALL_SERVICES)): shell-%:
	@echo "${BLUE}🐚 Accessing $* shell...${NC}"
	@docker-compose exec $* /bin/bash || docker-compose exec $* /bin/sh

db-shell: ## Access PostgreSQL shell
	@echo "${BLUE}🐚 Accessing PostgreSQL shell...${NC}"
	@docker-compose exec postgres psql -U $(shell grep DB_USER .env | cut -d= -f2) -d $(shell grep DB_NAME .env | cut -d= -f2)

show-urls: ## Show all service URLs
	@echo ""
	@echo "${PURPLE}🌐 Service URLs:${NC}"
	@echo "${CYAN}  Gateway:     ${GREEN}http://localhost:8080${NC}"
	@echo "${CYAN}  Auth:        ${GREEN}http://localhost:8001${NC}"
	@echo "${CYAN}  Expense:     ${GREEN}http://localhost:8002${NC}"
	@echo "${CYAN}  Income:      ${GREEN}http://localhost:8003${NC}"
	@echo "${CYAN}  Category:    ${GREEN}http://localhost:8004${NC}"
	@echo "${CYAN}  Analytics:   ${GREEN}http://localhost:8005${NC}"
	@echo "${CYAN}  Reporting:   ${GREEN}http://localhost:8006${NC}"
	@echo "${CYAN}  ML Engine:   ${GREEN}http://localhost:8007${NC}"
	@echo "${CYAN}  PostgreSQL:  ${GREEN}localhost:5433${NC} ${YELLOW}(external port)${NC}"
	@echo "${CYAN}  RabbitMQ:    ${GREEN}http://localhost:15672${NC} ${YELLOW}(admin UI)${NC}"
	@echo ""

#============================================================================
# 🧹 CLEANUP COMMANDS
#============================================================================

clean: ## Remove containers
	@echo "${BLUE}🧹 Cleaning up containers...${NC}"
	@docker-compose down --remove-orphans
	@echo "${GREEN}✅ Containers cleaned${NC}"

clean-images: ## Remove project images
	@echo "${BLUE}🧹 Removing project images...${NC}"
	@docker images | grep $(PROJECT_NAME) | awk '{print $$3}' | xargs -r docker rmi -f
	@echo "${GREEN}✅ Images cleaned${NC}"

reset: ## Complete reset (nuclear option)
	@echo "${RED}⚠️  This will destroy ALL data and containers!${NC}"
	@read -p "Are you absolutely sure? [y/N]: " confirm && [ "$$confirm" = y ] || exit 1
	@echo "${BLUE}🗑️  Performing complete reset...${NC}"
	@docker-compose down -v --remove-orphans
	@docker images | grep $(PROJECT_NAME) | awk '{print $$3}' | xargs -r docker rmi -f
	@docker system prune -f
	@echo "${GREEN}✅ Complete reset done${NC}"

#============================================================================
# 🛠️ INTERNAL HELPERS
#============================================================================

check-env:
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "${RED}❌ .env file not found! Run 'make setup' first${NC}"; \
		exit 1; \
	fi

# Ensure .env exists for commands that need it
up down restart build-all: | check-env