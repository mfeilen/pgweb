package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"github.com/sosedoff/pgweb/pkg/command"
)

func TestGetInfo(t *testing.T) {
	gin.SetMode(gin.TestMode)

	previous := command.Opts
	defer func() { command.Opts = previous }()
	command.Opts.DarkMode = true

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/info", nil)

	GetInfo(c)

	assert.Equal(t, http.StatusOK, recorder.Code)

	var body struct {
		Features map[string]interface{} `json:"features"`
	}
	assert.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, true, body.Features["dark_mode"])
	assert.Equal(t, false, body.Features["session_lock"])
}
