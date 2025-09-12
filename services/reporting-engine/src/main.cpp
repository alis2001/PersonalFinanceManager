#include <iostream>
#include <string>
#include <cstdlib>
#include <signal.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <sstream>

bool running = true;
int server_fd;

void signalHandler(int signum) {
    std::cout << "\nShutting down Reporting Engine..." << std::endl;
    running = false;
    if (server_fd > 0) {
        close(server_fd);
    }
    exit(0);
}

std::string handleHealthCheck() {
    std::string response = R"({"status":"healthy","service":"Reporting Engine","version":"1.0.0"})";
    
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
    std::string response = R"({"service":"Finance Reporting Engine","version":"1.0.0","status":"running","endpoints":{"/health":"Health check","/reports":"Generate reports"}})";
    
    std::stringstream http_response;
    http_response << "HTTP/1.1 200 OK\r\n"
                  << "Content-Type: application/json\r\n"
                  << "Content-Length: " << response.length() << "\r\n"
                  << "Access-Control-Allow-Origin: *\r\n"
                  << "\r\n"
                  << response;
    
    return http_response.str();
}

int main() {
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);
    
    int port = 8080;
    
    struct sockaddr_in address;
    int opt = 1;
    
    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        std::cerr << "Socket creation failed" << std::endl;
        return 1;
    }
    
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt));
    
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port);
    
    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        std::cerr << "Bind failed on port " << port << std::endl;
        return 1;
    }
    
    if (listen(server_fd, 10) < 0) {
        std::cerr << "Listen failed" << std::endl;
        return 1;
    }
    
    std::cout << "Reporting Engine listening on port " << port << std::endl;
    
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
        
        char buffer[4096] = {0};
        read(client_socket, buffer, sizeof(buffer) - 1);
        
        std::string request(buffer);
        std::string response;
        
        if (request.find("GET /health") != std::string::npos) {
            response = handleHealthCheck();
        } else if (request.find("GET /") != std::string::npos) {
            response = handleRootRequest();
        } else {
            response = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
        }
        
        send(client_socket, response.c_str(), response.length(), 0);
        close(client_socket);
    }
    
    return 0;
}