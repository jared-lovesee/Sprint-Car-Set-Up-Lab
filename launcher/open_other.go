//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
)

func openWindow(url string) error {
	for _, c := range []string{"xdg-open", "open"} {
		if p, err := exec.LookPath(c); err == nil {
			return exec.Command(p, url).Start()
		}
	}
	fmt.Println("Open", url)
	return nil
}

func fatal(msg string) { fmt.Fprintln(os.Stderr, msg); os.Exit(1) }
