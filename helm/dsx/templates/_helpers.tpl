{{/*
Expand the name of the chart.
*/}}
{{- define "dsx.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
Truncated at 63 chars (DNS naming spec limit).
*/}}
{{- define "dsx.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart name and version for the chart label.
*/}}
{{- define "dsx.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to all resources.
*/}}
{{- define "dsx.labels" -}}
helm.sh/chart: {{ include "dsx.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ include "dsx.name" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- end }}

{{/*
Web component labels.
*/}}
{{- define "dsx.web.labels" -}}
{{ include "dsx.labels" . }}
{{ include "dsx.web.selectorLabels" . }}
{{- end }}

{{/*
Web component selector labels.
*/}}
{{- define "dsx.web.selectorLabels" -}}
app.kubernetes.io/name: {{ include "dsx.name" . }}-web
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: web
{{- end }}

{{/*
Kit component labels.
*/}}
{{- define "dsx.kit.labels" -}}
{{ include "dsx.labels" . }}
{{ include "dsx.kit.selectorLabels" . }}
{{- end }}

{{/*
Kit component selector labels.
*/}}
{{- define "dsx.kit.selectorLabels" -}}
app.kubernetes.io/name: {{ include "dsx.name" . }}-kit
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: kit
{{- end }}

{{/*
Web component fully qualified name.
*/}}
{{- define "dsx.web.fullname" -}}
{{- printf "%s-web" (include "dsx.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Kit component fully qualified name.
*/}}
{{- define "dsx.kit.fullname" -}}
{{- printf "%s-kit" (include "dsx.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Service account name.
*/}}
{{- define "dsx.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "dsx.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Secret name -- use existing or generate.
*/}}
{{- define "dsx.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- include "dsx.fullname" . }}
{{- end }}
{{- end }}

{{/*
Web image reference.
*/}}
{{- define "dsx.web.image" -}}
{{- printf "%s:%s" .Values.web.image.repository (default .Chart.AppVersion .Values.web.image.tag) }}
{{- end }}

{{/*
Kit image reference.
*/}}
{{- define "dsx.kit.image" -}}
{{- printf "%s:%s" .Values.kit.image.repository (default .Chart.AppVersion .Values.kit.image.tag) }}
{{- end }}
