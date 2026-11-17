package cli

import (
	"runtime/debug"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// pgweb must not open Multipath TCP (MPTCP) listeners. Go 1.24+ enables MPTCP
// for every listener by default; the published exploit for the Linux kernel
// use-after-free CVE-2026-98432 needs an MPTCP listener on the target. The
// "godebug multipathtcp=0" directive in go.mod turns it off for all sockets
// opened by this module. This test guards that directive.
//
// DefaultGODEBUG only lists settings that differ from the Go default. Should a
// future Go release make multipathtcp=0 the default, the key disappears from the
// build info and this test fails although the goal is met; drop the test then.
func TestMultipathTCPDisabledByDefault(t *testing.T) {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		t.Skip("build info not available")
	}

	for _, s := range info.Settings {
		if s.Key != "DefaultGODEBUG" {
			continue
		}
		for _, kv := range strings.Split(s.Value, ",") {
			if kv == "multipathtcp=0" {
				return
			}
		}
		assert.Fail(t, "multipathtcp=0 missing from DefaultGODEBUG", "got: %s", s.Value)
		return
	}

	assert.Fail(t, "DefaultGODEBUG build setting not found; expected godebug multipathtcp=0 in go.mod")
}
