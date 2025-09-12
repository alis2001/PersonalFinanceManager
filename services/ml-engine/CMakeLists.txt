cmake_minimum_required(VERSION 3.16)
project(ml-engine)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
file(GLOB_RECURSE SOURCES "src/*.cpp")

# Create executable
add_executable(ml-engine ${SOURCES})

# Link libraries
target_link_libraries(ml-engine 
    pthread
)