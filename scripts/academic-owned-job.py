"""Windows kernel job supervisor. Only processes assigned before resume belong."""
import ctypes
from ctypes import wintypes
import json
import subprocess
import sys
import threading
import time

kernel = ctypes.WinDLL('kernel32', use_last_error=True)
ntdll = ctypes.WinDLL('ntdll')
kernel.CreateJobObjectW.restype = wintypes.HANDLE
kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
kernel.QueryInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD, ctypes.c_void_p]
kernel.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
kernel.CloseHandle.argtypes = [wintypes.HANDLE]
ntdll.NtResumeProcess.argtypes = [wintypes.HANDLE]

class BasicLimits(ctypes.Structure):
    _fields_ = [('process_time', ctypes.c_longlong), ('job_time', ctypes.c_longlong),
                ('flags', wintypes.DWORD), ('minimum', ctypes.c_size_t), ('maximum', ctypes.c_size_t),
                ('active_limit', wintypes.DWORD), ('affinity', ctypes.c_size_t),
                ('priority', wintypes.DWORD), ('scheduling', wintypes.DWORD)]

class ExtendedLimits(ctypes.Structure):
    _fields_ = [('basic', BasicLimits), ('io', ctypes.c_ulonglong * 6),
                ('process_memory', ctypes.c_size_t), ('job_memory', ctypes.c_size_t),
                ('peak_process', ctypes.c_size_t), ('peak_job', ctypes.c_size_t)]

class Accounting(ctypes.Structure):
    _fields_ = [('times', ctypes.c_longlong * 4), ('faults', wintypes.DWORD),
                ('total', wintypes.DWORD), ('active', wintypes.DWORD), ('terminated', wintypes.DWORD)]

def checked(value, operation):
    if not value:
        raise OSError(ctypes.get_last_error(), operation)

def event(value):
    print('\n@@ACADEMIC_JOB@@' + json.dumps(value), flush=True)

job = kernel.CreateJobObjectW(None, None)
checked(job, 'CreateJobObjectW')
payload = None
try:
    limits = ExtendedLimits()
    limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE; breakaway is not enabled.
    checked(kernel.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)), 'SetInformationJobObject')
    payload = subprocess.Popen(sys.argv[1:], stdin=subprocess.DEVNULL, creationflags=0x00000004 | subprocess.CREATE_NO_WINDOW)  # Win32 CREATE_SUSPENDED
    handle = wintypes.HANDLE(int(payload._handle))
    checked(kernel.AssignProcessToJobObject(job, handle), 'AssignProcessToJobObject')
    if ntdll.NtResumeProcess(handle) != 0:
        raise OSError('NtResumeProcess failed')
    stopping = threading.Event()
    def control():
        # EOF also means the owning runner exited unexpectedly.
        sys.stdin.buffer.readline()
        stopping.set()
    threading.Thread(target=control, daemon=True).start()
    event({'ready': True})
    reported = False
    while not stopping.wait(0.03):
        code = payload.poll()
        if code is not None and not reported:
            event({'rootExit': code})
            reported = True
        # Keep the job handle alive after root exit until explicit cleanup.
    checked(kernel.TerminateJobObject(job, 1), 'TerminateJobObject')
    deadline = time.monotonic() + 10
    while True:
        accounting = Accounting()
        checked(kernel.QueryInformationJobObject(job, 1, ctypes.byref(accounting), ctypes.sizeof(accounting), None), 'QueryInformationJobObject')
        if accounting.active == 0:
            event({'stopped': True, 'activeProcesses': 0, 'totalProcesses': accounting.total})
            break
        if time.monotonic() >= deadline:
            raise TimeoutError('Owned job still contains active processes')
        time.sleep(0.03)
except BaseException as error:
    event({'error': str(error)})
    if payload is not None and payload.poll() is None:
        payload.terminate()
    sys.exit(1)
finally:
    kernel.CloseHandle(job)
