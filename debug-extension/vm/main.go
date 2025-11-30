package main

import (
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/sirupsen/logrus"
)

var (
	logger    = logrus.New()
	startTime = time.Now()
)

func main() {
	var socketPath string
	flag.StringVar(&socketPath, "socket", "/run/guest-services/backend.sock", "Unix domain socket to listen on")
	flag.Parse()

	logger.SetOutput(os.Stdout)
	logger.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})

	// Ensure the socket directory exists
	socketDir := socketPath[:strings.LastIndex(socketPath, "/")]
	if err := os.MkdirAll(socketDir, 0755); err != nil {
		logger.Fatalf("Failed to create socket directory %s: %v", socketDir, err)
	}

	// Remove existing socket file if it exists
	os.RemoveAll(socketPath)

	logger.Infof("Starting debug backend service on %s", socketPath)

	router := echo.New()
	router.HideBanner = true
	router.HidePort = true

	// Add logging middleware
	router.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: "method=${method}, uri=${uri}, status=${status}, latency=${latency_human}\n",
		Output: os.Stdout,
	}))
	router.Use(middleware.Recover())

	// API endpoints
	router.GET("/", root)
	router.GET("/health", health)
	router.GET("/info", info)
	router.GET("/env", env)
	router.GET("/system", system)
	router.GET("/filesystem", filesystem)
	router.GET("/processes", processes)
	router.GET("/network", network)

	// Create Unix socket listener
	ln, err := net.Listen("unix", socketPath)
	if err != nil {
		logger.Fatalf("Failed to create socket: %v", err)
	}

	// Set socket permissions to be accessible
	if err := os.Chmod(socketPath, 0666); err != nil {
		logger.Warnf("Failed to chmod socket: %v", err)
	}

	router.Listener = ln
	logger.Fatal(router.Start(""))
}

// Root endpoint - API discovery
func root(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"service": "debug-backend",
		"version": "1.0.0",
		"endpoints": []string{
			"/health",
			"/info",
			"/env",
			"/system",
			"/filesystem",
			"/processes",
			"/network",
		},
	})
}

// Health check
func health(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"status": "healthy",
		"uptime": time.Since(startTime).String(),
	})
}

// Container/system info
func info(c echo.Context) error {
	hostname, _ := os.Hostname()
	wd, _ := os.Getwd()
	executable, _ := os.Executable()

	userInfo := map[string]interface{}{
		"uid": os.Getuid(),
		"gid": os.Getgid(),
		"pid": os.Getpid(),
	}

	// Try to get username
	if userCmd, err := exec.Command("whoami").Output(); err == nil {
		userInfo["username"] = strings.TrimSpace(string(userCmd))
	}

	// Try to get user groups
	if groupsCmd, err := exec.Command("id").Output(); err == nil {
		userInfo["id_output"] = strings.TrimSpace(string(groupsCmd))
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"hostname":   hostname,
		"pid":        os.Getpid(),
		"user":       userInfo,
		"workingDir": wd,
		"executable": executable,
		"goVersion":  runtime.Version(),
		"goOS":       runtime.GOOS,
		"goArch":     runtime.GOARCH,
		"numCPU":     runtime.NumCPU(),
		"uptime":     time.Since(startTime).String(),
	})
}

// Environment variables
func env(c echo.Context) error {
	filter := c.QueryParam("filter")

	envVars := make(map[string]string)
	for _, e := range os.Environ() {
		pair := strings.SplitN(e, "=", 2)
		if len(pair) == 2 {
			key := pair[0]
			value := pair[1]

			// Apply filter if provided
			if filter != "" && !strings.Contains(strings.ToLower(key), strings.ToLower(filter)) {
				continue
			}

			envVars[key] = value
		}
	}

	// Sort keys for consistent output
	keys := make([]string, 0, len(envVars))
	for k := range envVars {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	sortedEnv := make([]map[string]string, 0, len(keys))
	for _, k := range keys {
		sortedEnv = append(sortedEnv, map[string]string{
			"name":  k,
			"value": envVars[k],
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"count":     len(sortedEnv),
		"filter":    filter,
		"variables": sortedEnv,
	})
}

// System information from /etc/os-release and uname
func system(c echo.Context) error {
	result := make(map[string]interface{})

	// Get uname info
	if unameOutput, err := exec.Command("uname", "-a").Output(); err == nil {
		result["uname"] = strings.TrimSpace(string(unameOutput))
	}

	// Get individual uname components
	if kernelName, err := exec.Command("uname", "-s").Output(); err == nil {
		result["kernelName"] = strings.TrimSpace(string(kernelName))
	}
	if kernelRelease, err := exec.Command("uname", "-r").Output(); err == nil {
		result["kernelRelease"] = strings.TrimSpace(string(kernelRelease))
	}
	if machine, err := exec.Command("uname", "-m").Output(); err == nil {
		result["machine"] = strings.TrimSpace(string(machine))
	}

	// Parse /etc/os-release if available
	if osRelease, err := os.ReadFile("/etc/os-release"); err == nil {
		osInfo := make(map[string]string)
		for _, line := range strings.Split(string(osRelease), "\n") {
			if strings.TrimSpace(line) == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := parts[0]
				value := strings.Trim(parts[1], `"`)
				osInfo[key] = value
			}
		}
		result["osRelease"] = osInfo
	}

	// Memory info
	if memInfo, err := os.ReadFile("/proc/meminfo"); err == nil {
		memMap := make(map[string]string)
		for _, line := range strings.Split(string(memInfo), "\n") {
			if strings.HasPrefix(line, "MemTotal:") ||
				strings.HasPrefix(line, "MemFree:") ||
				strings.HasPrefix(line, "MemAvailable:") ||
				strings.HasPrefix(line, "Buffers:") ||
				strings.HasPrefix(line, "Cached:") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					key := strings.TrimSuffix(parts[0], ":")
					memMap[key] = strings.Join(parts[1:], " ")
				}
			}
		}
		result["memory"] = memMap
	}

	// CPU info (just count and model)
	if cpuInfo, err := os.ReadFile("/proc/cpuinfo"); err == nil {
		cpuCount := 0
		var modelName string
		for _, line := range strings.Split(string(cpuInfo), "\n") {
			if strings.HasPrefix(line, "processor") {
				cpuCount++
			}
			if strings.HasPrefix(line, "model name") && modelName == "" {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					modelName = strings.TrimSpace(parts[1])
				}
			}
		}
		result["cpu"] = map[string]interface{}{
			"count": cpuCount,
			"model": modelName,
		}
	}

	return c.JSON(http.StatusOK, result)
}

// Filesystem structure
func filesystem(c echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		path = "/"
	}

	result := make(map[string]interface{})
	result["path"] = path

	// List directory contents
	entries, err := os.ReadDir(path)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"path":  path,
			"error": err.Error(),
		})
	}

	files := make([]map[string]interface{}, 0)
	for _, entry := range entries {
		info, _ := entry.Info()
		fileInfo := map[string]interface{}{
			"name":  entry.Name(),
			"isDir": entry.IsDir(),
			"type":  entry.Type().String(),
		}
		if info != nil {
			fileInfo["size"] = info.Size()
			fileInfo["mode"] = info.Mode().String()
			fileInfo["modTime"] = info.ModTime().Format(time.RFC3339)
		}
		files = append(files, fileInfo)
	}

	result["entries"] = files
	result["count"] = len(files)

	// Add mount info if looking at root
	if path == "/" {
		if mounts, err := os.ReadFile("/proc/mounts"); err == nil {
			mountLines := strings.Split(string(mounts), "\n")
			mountInfo := make([]map[string]string, 0)
			for _, line := range mountLines {
				fields := strings.Fields(line)
				if len(fields) >= 4 {
					mountInfo = append(mountInfo, map[string]string{
						"device":     fields[0],
						"mountPoint": fields[1],
						"fsType":     fields[2],
						"options":    fields[3],
					})
				}
			}
			result["mounts"] = mountInfo
		}
	}

	return c.JSON(http.StatusOK, result)
}

// Running processes
func processes(c echo.Context) error {
	result := make(map[string]interface{})

	// Get process list using ps
	if psOutput, err := exec.Command("ps", "aux").Output(); err == nil {
		lines := strings.Split(string(psOutput), "\n")
		processes := make([]map[string]string, 0)

		var headers []string
		for i, line := range lines {
			if strings.TrimSpace(line) == "" {
				continue
			}
			if i == 0 {
				// Parse headers
				headers = strings.Fields(line)
				continue
			}

			// Parse process line
			fields := strings.Fields(line)
			if len(fields) >= len(headers) {
				proc := make(map[string]string)
				for j, h := range headers {
					if j == len(headers)-1 {
						// Last field (COMMAND) may have spaces
						proc[h] = strings.Join(fields[j:], " ")
					} else {
						proc[h] = fields[j]
					}
				}
				processes = append(processes, proc)
			}
		}
		result["processes"] = processes
		result["count"] = len(processes)
	} else {
		result["error"] = fmt.Sprintf("Failed to get processes: %v", err)
	}

	return c.JSON(http.StatusOK, result)
}

// Network information
func network(c echo.Context) error {
	result := make(map[string]interface{})

	// Get hostname
	if hostname, err := os.Hostname(); err == nil {
		result["hostname"] = hostname
	}

	// Get network interfaces using Go's net package
	interfaces, err := net.Interfaces()
	if err == nil {
		ifaceInfo := make([]map[string]interface{}, 0)
		for _, iface := range interfaces {
			info := map[string]interface{}{
				"name":  iface.Name,
				"mtu":   iface.MTU,
				"flags": iface.Flags.String(),
			}
			if iface.HardwareAddr != nil {
				info["mac"] = iface.HardwareAddr.String()
			}

			// Get addresses
			addrs, _ := iface.Addrs()
			addrStrings := make([]string, 0)
			for _, addr := range addrs {
				addrStrings = append(addrStrings, addr.String())
			}
			info["addresses"] = addrStrings

			ifaceInfo = append(ifaceInfo, info)
		}
		result["interfaces"] = ifaceInfo
	}

	// DNS configuration
	if resolv, err := os.ReadFile("/etc/resolv.conf"); err == nil {
		nameservers := make([]string, 0)
		searchDomains := make([]string, 0)
		for _, line := range strings.Split(string(resolv), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "nameserver ") {
				nameservers = append(nameservers, strings.TrimPrefix(line, "nameserver "))
			}
			if strings.HasPrefix(line, "search ") {
				searchDomains = strings.Fields(strings.TrimPrefix(line, "search "))
			}
		}
		result["dns"] = map[string]interface{}{
			"nameservers":   nameservers,
			"searchDomains": searchDomains,
		}
	}

	// Hosts file
	if hosts, err := os.ReadFile("/etc/hosts"); err == nil {
		hostEntries := make([]string, 0)
		for _, line := range strings.Split(string(hosts), "\n") {
			line = strings.TrimSpace(line)
			if line != "" && !strings.HasPrefix(line, "#") {
				hostEntries = append(hostEntries, line)
			}
		}
		result["hosts"] = hostEntries
	}

	return c.JSON(http.StatusOK, result)
}
