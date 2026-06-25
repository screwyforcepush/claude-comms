# Task Monitoring & Active Polling Rules

To prevent issues where the agent halts tool execution and waits for background notifications that never arrive:

1. **Maximize Synchronous Wait:** When executing `run_command`, always set `WaitMsBeforeAsync` to a high value (up to the maximum of `10000` ms) to allow the command to complete synchronously.
2. **Do Not Wait Passively:** Never stop calling tools to wait indefinitely for automatic task-completion notifications. 
3. **Active Wakeup Timers:** If a command is backgrounded, immediately schedule a short one-shot timer (using the `schedule` tool with `DurationSeconds` between `10` and `30` and `TimerCondition="never"`). This forces a reactive wakeup.
4. **Manual Status Polling:** Upon being woken up by the timer, explicitly check the task's progress using `manage_task` (with action `status` or `list`) or by checking log files, repeating this polling cycle until the task is complete.
