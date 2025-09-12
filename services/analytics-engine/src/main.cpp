#include <iostream>
#include <string>
#include <cstdlib>
#include <signal.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <thread>
#include <sstream>

bool running = true;
int server_fd;

void signalHandler(int signum) {
    std::cout << "\nShutting down Analytics Engine..." << std::endl;
    running = false;
    if (server_fd > 0) {
        close(server_fd);
    }
    exit(0);
}

std::string getCurrentTimestamp() {
    time_t now = time(0);
    char* dt = ctime(&now);
    std::string timestamp(dt);
    // Remove newline
    if (!timestamp.empty() && timestamp.back() == '\n') {
        timestamp.pop_back();
    }
    return timestamp;
}

std::string handleHealthCheck() {
    std::string response = R"({
  "status": "healthy",
  "service": "Analytics Engine",
  "version": "1.0.0",
  "timestamp": ")" + getCurrentTimestamp() + R"("
})";
    
    std::stringstream http_response;
    http_response << "HTTP/1.1 200 OK\r\n"
                  << "Content-Type: application/json\r\n"
                  << "Content-Length: " << response.length() << "\r\n"
                  << "Access-Control-Allow-Origin: *\r\n"
                  << "\r\n"
                  << response;
    
    return http_response.str();
}

std::string handleRootRequest() {
    std::string response = R"({
  "service": "Finance Analytics Engine",
  "version": "1.0.0",
  "description": "High-performance C++ analytics engine for financial calculations",
  "endpoints": {
    "health": "GET /health",
    "spending_analysis": "GET /spending-analysis",
    "trends": "GET /trends",
    "predictions": "GET /predictions"
  },
  "capabilities": [
    "Real-time expense analysis",
    "Trend detection",
    "Statistical calculations",
    "Predictive modeling"
  ]
})";
    
    std::stringstream http_response;
    http_response << "HTTP/1.1 200 OK\r\n"
                  << "Content-Type: application/json\r\n"
                  << "Content-Length: " << response.length() << "\r\n"
                  << "Access-Control-Allow-Origin: *\r\n"
                  << "\r\n"
                  << response;
    
    return http_response.str();
}

std::string handleSpendingAnalysis() {
    // Mock spending analysis data
    std::string response = R"({
  "analysis": {
    "total_expenses": 2847.32,
    "average_daily_spending": 94.91,
    "spending_trend": "increasing",
    "top_categories": [
      {"category": "Food & Dining", "amount": 856.23, "percentage": 30.1},
      {"category": "Transportation", "amount": 445.67, "percentage": 15.6},
      {"category": "Shopping", "amount": 398.12, "percentage": 14.0}
    ],
    "insights": [
      "Spending increased by 12% compared to last month",
      "Food expenses are above average",
      "Transportation costs are stable"
    ]
  },
  "generated_at": ")" + getCurrentTimestamp() + R"(",
  "engine": "Analytics Engine v1.0"
})";
    
    std::stringstream http_response;
    http_response << "HTTP/1.1 200 OK\r\n"
                  << "Content-Type: application/json\r\n"
                  << "Content-Length: " << response.length() << "\r\n"
                  << "Access-Control-Allow-Origin: *\r\n"
                  << "\r\n"
                  << response;
    
    return http_response.str();
}

std::string handleTrends() {
    // Mock trend analysis
    std::string response = R"({
  "trends": {
    "monthly_trend": {
      "direction": "upward",
      "percentage_change": 8.5,
      "confidence": 0.87
    },
    "category_trends": [
      {"category": "Food & Dining", "trend": "increasing", "change": 15.2},
      {"category": "Transportation", "trend": "stable", "change": -2.1},
      {"category": "Entertainment", "trend": "decreasing", "change": -8.7}
    ],
    "seasonal_patterns": {
      "peak_months": ["December", "January"],
      "low_months": ["February", "March"]
    }
  },
  "analysis_period": "last_12_months",
  "generated_at": ")" + getCurrentTimestamp() + R"("
})";
    
    std::stringstream http_response;
    http_response << "HTTP/1.1 200 OK\r\n"
                  << "Content-Type: application/json\r\n"
                  << "Content-Length: " << response.length() << "\r\n"
                  << "Access-Control-Allow-Origin: *\r\n"
                  << "\r\n"
                  << response;
    
    return http_response.str();
}

std::string handlePredictions() {
    // Mock predictions
    std::string response = R"({
  "predictions": {
    "next_month_spending": {
      "estimated_total": 3150.50,
      "confidence_interval": {
        "lower": 2890.00,
        "upper": 3410.00
      },
      "confidence_level": 0.85
    },
    "budget_alerts": [
      {
        "category": "Food & Dining",
        "risk_level": "high",
        "predicted_overspend": 156.78
      }
    ],
    "recommendations": [
      "Consider reducing dining out expenses",
      "Transportation costs are well managed",
      "Set a stricter budget for shopping"
    ]
  },
  "model_version": "1.0",
  "generated_at": ")" + getCurrentTimestamp() + R"("
})";
    
    std::stringstream http_response;
    http_response << "HTTP/1.1 200 OK\r\n"
                  << "Content-Type: application/json\r\n"
                  << "Content-Length: " << response.length() << "\r\n"
                  << "Access-Control-Allow-Origin: *\r\n"
                  << "\r\n"
                  << response;
    
    return http_response.str();
}

std::string handle404() {
    std::string response = R"({
  "error": "Endpoint not found",
  "available_endpoints": ["/health", "/", "/spending-analysis", "/trends", "/predictions"]
})";
    
    std::stringstream http_response;
    http_response << "HTTP/1.1 404 Not Found\r\n"
                  << "Content-Type: application/json\r\n"
                  << "Content-Length: " << response.length() << "\r\n"
                  << "Access-Control-Allow-Origin: *\r\n"
                  << "\r\n"
                  << response;
    
    return http_response.str();
}

void handleClient(int client_socket) {
    char buffer[4096] = {0};
    ssize_t bytes_read = read(client_socket, buffer, sizeof(buffer) - 1);
    
    if (bytes_read <= 0) {
        close(client_socket);
        return;
    }
    
    std::string request(buffer, bytes_read);
    std::string response;
    
    // Parse HTTP request
    std::istringstream request_stream(request);
    std::string method, path, version;
    request_stream >> method >> path >> version;
    
    std::cout << "Request: " << method << " " << path << std::endl;
    
    // Route handling
    if (path == "/health") {
        response = handleHealthCheck();
    } else if (path == "/") {
        response = handleRootRequest();
    } else if (path == "/spending-analysis") {
        response = handleSpendingAnalysis();
    } else if (path == "/trends") {
        response = handleTrends();
    } else if (path == "/predictions") {
        response = handlePredictions();
    } else {
        response = handle404();
    }
    
    // Send response
    send(client_socket, response.c_str(), response.length(), 0);
    close(client_socket);
}

int main() {
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);
    
    int port = 8080;
    
    struct sockaddr_in address;
    int opt = 1;
    
    // Create socket
    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        std::cerr << "Socket creation failed" << std::endl;
        return 1;
    }
    
    // Set socket options
    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt))) {
        std::cerr << "Setsockopt failed" << std::endl;
        return 1;
    }
    
    // Configure address
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port);
    
    // Bind socket
    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        std::cerr << "Bind failed on port " << port << std::endl;
        return 1;
    }
    
    // Listen for connections
    if (listen(server_fd, 10) < 0) {
        std::cerr << "Listen failed" << std::endl;
        return 1;
    }
    
    std::cout << "🚀 Analytics Engine listening on port " << port << std::endl;
    std::cout << "📊 Ready to process financial analytics requests" << std::endl;
    std::cout << "🔗 Available endpoints:" << std::endl;
    std::cout << "   - GET /health" << std::endl;
    std::cout << "   - GET /spending-analysis" << std::endl;
    std::cout << "   - GET /trends" << std::endl;
    std::cout << "   - GET /predictions" << std::endl;
    
    // Main server loop
    while (running) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        
        int client_socket = accept(server_fd, (struct sockaddr *)&client_addr, &client_len);
        if (client_socket < 0) {
            if (running) {
                std::cerr << "Accept failed" << std::endl;
            }
            continue;
        }
        
        // Handle client in a separate thread for better performance
        std::thread client_thread(handleClient, client_socket);
        client_thread.detach();
    }
    
    return 0;
}