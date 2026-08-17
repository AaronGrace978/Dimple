!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\DirectX\UserGpuPreferences" "$INSTDIR\Dimple.exe" "GpuPreference=2;"
!macroend
