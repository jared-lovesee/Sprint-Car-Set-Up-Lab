//go:build windows

package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

// openWindow starts Edge (or Chrome) in app mode: its own window, no tabs or address bar.
func openWindow(url string) error {
	pf := []string{os.Getenv("ProgramFiles(x86)"), os.Getenv("ProgramFiles"), os.Getenv("LocalAppData")}
	rel := []string{`Microsoft\Edge\Application\msedge.exe`, `Google\Chrome\Application\chrome.exe`}
	profile := filepath.Join(os.Getenv("LocalAppData"), "SprintCarSetupLab", "window")
	_ = os.MkdirAll(profile, 0o755)
	for _, r := range rel {
		for _, base := range pf {
			if base == "" {
				continue
			}
			exe := filepath.Join(base, r)
			if _, err := os.Stat(exe); err == nil {
				cmd := exec.Command(exe,
					"--app="+url,
					"--user-data-dir="+profile,
					"--window-size=1440,900",
					"--no-first-run", "--no-default-browser-check",
					"--disable-background-timer-throttling",
					"--disable-features=Translate,msEdgeSidebarV2,msHubApps",
				)
				if err := cmd.Start(); err == nil {
					return nil
				}
			}
		}
	}
	// fall back to the default browser
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	if err := cmd.Start(); err != nil {
		return errors.New("Microsoft Edge or Google Chrome was not found.")
	}
	return nil
}

func fatal(msg string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	box := user32.NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(appName)
	m, _ := syscall.UTF16PtrFromString(msg)
	box.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
	os.Exit(1)
}
