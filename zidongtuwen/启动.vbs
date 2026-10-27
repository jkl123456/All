Option Explicit
Dim sh, fso, base, py, code, line, probe
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

base = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = base

py = "D:\miniconda\python.exe"
If Not fso.FileExists(py) Then
    If fso.FileExists(base & "\.venv\Scripts\python.exe") Then
        py = base & "\.venv\Scripts\python.exe"
    Else
        py = "python"
    End If
End If

code = "import socket,sys;sys.exit(0 if socket.socket().connect_ex(('127.0.0.1',8879))==0 else 1)"
line = "cmd /c " & Chr(34) & py & Chr(34) & " -c " & Chr(34) & code & Chr(34)
probe = sh.Run(line, 0, True)

If probe <> 0 Then
    sh.Run Chr(34) & py & Chr(34) & " " & Chr(34) & base & "\app.py" & Chr(34), 0, False
    WScript.Sleep 4500
End If

sh.Run "http://127.0.0.1:8879", 1, False
