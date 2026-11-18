package command

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/mitchellh/go-homedir"
	"github.com/stretchr/testify/assert"
)

func TestParseOptions(t *testing.T) {
	var hdir string
	if d, err := homedir.Dir(); err == nil {
		hdir = d
	}

	t.Run("defaults", func(t *testing.T) {
		opts, err := ParseOptions([]string{})
		assert.NoError(t, err)
		assert.Equal(t, false, opts.Sessions)
		assert.Equal(t, "", opts.Prefix)
		assert.Equal(t, "", opts.ConnectToken)
		assert.Equal(t, "", opts.ConnectHeaders)
		assert.Equal(t, false, opts.DisableSSH)
		assert.Equal(t, false, opts.DisablePrettyJSON)
		assert.Equal(t, false, opts.DisableConnectionIdleTimeout)
		assert.Equal(t, 180, opts.ConnectionIdleTimeout)
		assert.Equal(t, false, opts.Cors)
		assert.Equal(t, "*", opts.CorsOrigin)
		assert.Equal(t, "", opts.Passfile)
		assert.Equal(t, filepath.Join(hdir, ".pgweb/bookmarks"), opts.BookmarksDir)
		assert.Equal(t, "auto", opts.Theme)
	})

	t.Run("theme default", func(t *testing.T) {
		opts, err := ParseOptions([]string{})
		assert.NoError(t, err)
		assert.Equal(t, "auto", opts.Theme)
	})

	t.Run("theme flag", func(t *testing.T) {
		for _, v := range []string{"auto", "light", "dark"} {
			opts, err := ParseOptions([]string{"--theme", v})
			assert.NoError(t, err)
			assert.Equal(t, v, opts.Theme)
		}
		_, err := ParseOptions([]string{"--theme", "blue"})
		assert.EqualError(t, err, `invalid theme "blue": expected auto, light, dark or an id from docs/themes.md`)
	})

	t.Run("theme pack ids", func(t *testing.T) {
		opts, err := ParseOptions([]string{"--theme", "dracula"})
		assert.NoError(t, err)
		assert.Equal(t, "dracula", opts.Theme)

		t.Setenv("PGWEB_THEME", "one-dark")
		opts, err = ParseOptions([]string{})
		assert.NoError(t, err)
		assert.Equal(t, "one-dark", opts.Theme)
	})

	t.Run("theme env", func(t *testing.T) {
		t.Setenv("PGWEB_THEME", "Dark")
		opts, err := ParseOptions([]string{})
		assert.NoError(t, err)
		assert.Equal(t, "dark", opts.Theme)

		t.Setenv("PGWEB_THEME", "blue")
		_, err = ParseOptions([]string{})
		assert.EqualError(t, err, `invalid PGWEB_THEME value "blue": expected auto, light, dark or an id from docs/themes.md`)
	})

	t.Run("dark mode flag", func(t *testing.T) {
		opts, err := ParseOptions([]string{"--dark-mode"})
		assert.NoError(t, err)
		assert.Equal(t, "dark", opts.Theme)
	})

	t.Run("dark mode env", func(t *testing.T) {
		for _, v := range []string{"true", "1", "TRUE"} {
			t.Setenv("PGWEB_DARK_MODE", v)
			opts, err := ParseOptions([]string{})
			assert.NoError(t, err)
			assert.Equal(t, "dark", opts.Theme, v)
		}

		t.Setenv("PGWEB_DARK_MODE", "false")
		opts, err := ParseOptions([]string{})
		assert.NoError(t, err)
		assert.Equal(t, "light", opts.Theme)

		t.Setenv("PGWEB_DARK_MODE", "auto")
		opts, err = ParseOptions([]string{})
		assert.NoError(t, err)
		assert.Equal(t, "auto", opts.Theme)
	})

	t.Run("dark mode env invalid", func(t *testing.T) {
		t.Setenv("PGWEB_DARK_MODE", "garbage")
		_, err := ParseOptions([]string{})
		assert.EqualError(t, err, `invalid PGWEB_DARK_MODE value "garbage": expected true, false or auto`)
	})

	t.Run("flags win over env", func(t *testing.T) {
		t.Setenv("PGWEB_DARK_MODE", "false")
		opts, err := ParseOptions([]string{"--dark-mode"})
		assert.NoError(t, err)
		assert.Equal(t, "dark", opts.Theme)

		t.Setenv("PGWEB_THEME", "dark")
		opts, err = ParseOptions([]string{"--theme", "light"})
		assert.NoError(t, err)
		assert.Equal(t, "light", opts.Theme)
	})

	t.Run("sessions", func(t *testing.T) {
		opts, err := ParseOptions([]string{"--sessions", "1"})
		assert.NoError(t, err)
		assert.Equal(t, true, opts.Sessions)
	})

	t.Run("url prefix", func(t *testing.T) {
		opts, err := ParseOptions([]string{"--prefix", "pgweb"})
		assert.NoError(t, err)
		assert.Equal(t, "pgweb/", opts.Prefix)

		opts, err = ParseOptions([]string{"--prefix", "pgweb/"})
		assert.NoError(t, err)
		assert.Equal(t, "pgweb/", opts.Prefix)
	})

	t.Run("connect backend", func(t *testing.T) {
		_, err := ParseOptions([]string{"--connect-backend", "test"})
		assert.EqualError(t, err, "--sessions flag must be set")

		_, err = ParseOptions([]string{"--connect-backend", "test", "--sessions"})
		assert.EqualError(t, err, "--connect-token flag must be set")

		_, err = ParseOptions([]string{"--connect-backend", "test", "--sessions", "--connect-token", "token"})
		assert.NoError(t, err)
	})

	t.Run("passfile", func(t *testing.T) {
		defer os.Unsetenv("PGPASSFILE")

		// File does not exist
		os.Setenv("PGPASSFILE", "/tmp/foo")
		opts, err := ParseOptions([]string{})
		assert.NoError(t, err)
		assert.Equal(t, "", opts.Passfile)

		// File exists and valid
		os.Setenv("PGPASSFILE", "../../data/passfile")
		opts, err = ParseOptions([]string{})
		assert.NoError(t, err)
		assert.Equal(t, "../../data/passfile", opts.Passfile)

		// Set via flag
		os.Unsetenv("PGPASSFILE")
		opts, err = ParseOptions([]string{"--passfile", "../../data/passfile"})
		assert.NoError(t, err)
		assert.Equal(t, "../../data/passfile", opts.Passfile)
	})

	t.Run("bookmarks dir from env var", func(t *testing.T) {
		os.Setenv("PGWEB_BOOKMARKS_DIR", "/tmp/my-bookmarks")
		defer os.Unsetenv("PGWEB_BOOKMARKS_DIR")

		opts, err := ParseOptions([]string{})
		assert.NoError(t, err)
		assert.Equal(t, "/tmp/my-bookmarks", opts.BookmarksDir)
	})

	t.Run("bookmarks dir flag takes precedence over env var", func(t *testing.T) {
		os.Setenv("PGWEB_BOOKMARKS_DIR", "/tmp/my-bookmarks")
		defer os.Unsetenv("PGWEB_BOOKMARKS_DIR")

		flagDir := t.TempDir()

		opts, err := ParseOptions([]string{"--bookmarks-dir", flagDir})
		assert.NoError(t, err)
		assert.Equal(t, flagDir, opts.BookmarksDir)
	})

	t.Run("bookmarks only mode", func(t *testing.T) {
		_, err := ParseOptions([]string{"--bookmarks-only"})
		assert.NoError(t, err)

		_, err = ParseOptions([]string{"--bookmarks-only", "--url", "test"})
		assert.EqualError(t, err, "--url not supported in bookmarks-only mode")

		_, err = ParseOptions([]string{"--bookmarks-only", "--host", "test", "--port", "5432"})
		assert.EqualError(t, err, "--host not supported in bookmarks-only mode")

		_, err = ParseOptions([]string{"--bookmarks-only", "--connect-backend", "test", "--sessions", "--connect-token", "token", "--url", "127.0.0.2"})
		assert.EqualError(t, err, "--connect-backend not supported in bookmarks-only mode")
	})
}

func TestThemePackIDs(t *testing.T) {
	assert.NotEmpty(t, themePackIDs)

	seen := map[string]bool{}
	for _, id := range themePackIDs {
		assert.Regexp(t, `^[a-z0-9-]+$`, id)
		assert.NotContains(t, []string{"auto", "light", "dark"}, id)
		assert.False(t, seen[id], "duplicate id %s", id)
		seen[id] = true
		assert.True(t, validTheme(id), id)
	}
}
