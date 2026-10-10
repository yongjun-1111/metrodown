; Registers md-viewer as an "Open with" choice for Markdown files, alongside the default
; association Tauri writes. Windows builds the Open with list from OpenWithProgids and from
; the Applications key, so both are set; the user's chosen default app is left alone.

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\.md\OpenWithProgids" "Markdown document" ""
  WriteRegStr SHCTX "Software\Classes\.markdown\OpenWithProgids" "Markdown document" ""
  WriteRegStr SHCTX "Software\Classes\Applications\md-viewer.exe" "FriendlyAppName" "md-viewer"
  WriteRegStr SHCTX "Software\Classes\Applications\md-viewer.exe\SupportedTypes" ".md" ""
  WriteRegStr SHCTX "Software\Classes\Applications\md-viewer.exe\SupportedTypes" ".markdown" ""
  WriteRegStr SHCTX "Software\Classes\Applications\md-viewer.exe\shell\open\command" "" '"$INSTDIR\md-viewer.exe" "%1"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegValue SHCTX "Software\Classes\.md\OpenWithProgids" "Markdown document"
  DeleteRegValue SHCTX "Software\Classes\.markdown\OpenWithProgids" "Markdown document"
  DeleteRegKey SHCTX "Software\Classes\Applications\md-viewer.exe"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
