cmake_minimum_required(VERSION 3.16)
project(analytics-engine)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Include directories
include_directories(include)

# Source files
file(GLOB_RECURSE SOURCES "src/*.cpp")

# Create executable
add_executable(analytics-engine ${SOURCES})

# Link libraries (minimal for now)
target_link_libraries(analytics-engine 
    pthread
)