<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { default as sonicAxios, $hiveHttp as axios } from '../http/axios';
import Pageable from '../components/Pageable.vue';

const { t: $t } = useI18n();

const route = useRoute();
const STATUS_MAP = {
  0: $t('hiveTasks.notStarted'),
  1: $t('hiveTasks.running'),
  2: $t('hiveTasks.failed'),
  3: $t('hiveTasks.finished'),
};
const statusTagType = (status) => {
  switch (status) {
    case 0:
      return 'info';
    case 1:
      return 'warning';
    case 2:
      return 'danger';
    case 3:
      return 'success';
    default:
      return 'info';
  }
};
const statusLabel = (status) => {
  return STATUS_MAP[status] || 'Unknown';
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds
  return date
    .toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(/\//g, '-');
};
const dialogVisible = ref(false);
const pageData = ref({});
const pageSize = ref(15);
const pageCurrNum = ref(1);
const updateTask = ref(null);
const defaultTaskForm = {
  id: null,
  device_label: '',
  device_id: '',
  task_name: '',
  task_data: {
    app_number: null,
    account_name: '',
    video_path: '',
    description: '',
  },
  cron_time: null,
  status: 0, // Default to not started
};
const taskForm = ref(defaultTaskForm);

const searchForm = ref({
  id: '',
  device_id: '',
  task_name: '',
  status: null,
  cron_time_start: '',
  cron_time_end: '',
  addtime_start: '',
  addtime_end: '',
});
const taskDataDialog = ref(false);
const currentTaskData = ref({});

// Function to fetch device UDID when device_label loses focus
const fetchDeviceUDID = (label) => {
  if (label) {
    // Call API to get device UDID
    sonicAxios
      .get('/controller/devices/list', {
        params: {
          deviceInfo: label,
          page: 1,
          pageSize: 1,
        },
      })
      .then((resp) => {
        if (
          resp.code === 2000 &&
          resp.data &&
          resp.data.content &&
          resp.data.content.length > 0
        ) {
          // Set device_id to the first device's UDID
          taskForm.value.device_id = resp.data.content[0].udId || '';
        }
      })
      .catch((error) => {
        console.error('Failed to fetch device UDID:', error);
      });
  }
};

// Function to show task data in a dialog
const showTaskData = (data) => {
  currentTaskData.value = data;
  taskDataDialog.value = true;
};

// Task list display with pagination
const getTaskList = (pageNum, pSize) => {
  pageSize.value = pSize || pageSize.value;
  pageCurrNum.value = pageNum || pageCurrNum.value;
  const params = {
    page: pageCurrNum.value,
  };
  // Add search parameters
  if (searchForm.value.id) {
    params.id = searchForm.value.id;
  }
  if (searchForm.value.device_id) {
    params.device_id = searchForm.value.device_id;
  }
  if (searchForm.value.task_name) {
    params.task_name = searchForm.value.task_name;
  }
  if (searchForm.value.status !== null && searchForm.value.status !== '') {
    params.status = searchForm.value.status;
  }
  if (searchForm.value.cron_time_start) {
    params.cron_time_start = searchForm.value.cron_time_start;
  }
  if (searchForm.value.cron_time_end) {
    params.cron_time_end = searchForm.value.cron_time_end;
  }
  if (searchForm.value.addtime_start) {
    params.addtime_start = searchForm.value.addtime_start;
  }
  if (searchForm.value.addtime_end) {
    params.addtime_end = searchForm.value.addtime_end;
  }
  // Use correct API endpoint
  axios
    .get('/devices/tasks', {
      params,
    })
    .then((resp) => {
      pageData.value = {
        content: resp.data.tasks,
        totalElements: resp.data.total,
        number: resp.data.current_page - 1,
        size: resp.data.per_page,
      };
    });
};

// Get task info for editing
const getTaskInfo = (id) => {
  axios.get(`/devices/tasks`, { params: { id } }).then((resp) => {
    const data = resp.data.tasks && resp.data.tasks[0];
    taskForm.value = {
      id: data.id,
      device_label: data.device_label || '',
      device_id: data.device_id,
      task_name: data.task_name,
      task_data: {
        app_number: 1,
        account_name: '',
        video_path: '',
        description: '',
      },
      cron_time: data.cron_time,
      status: data.status,
    };

    // Populate task_data fields based on task_name
    if (data.task_name === 'publish_video' && data.task_data) {
      taskForm.value.task_data.app_number = data.task_data.app_number || null;
      taskForm.value.task_data.account_name = data.task_data.account_name || '';
      taskForm.value.task_data.video_path = data.task_data.video_path || '';
      taskForm.value.task_data.description = data.task_data.description || '';
    }
  });
};

// Update task status
const updateStatus = (id, status) => {
  // Validate status value
  if (!STATUS_MAP[status]) {
    ElMessage.error({
      message: 'Invalid status value',
    });
    return;
  }

  axios
    .put(`/devices/tasks/${id}`, {
      status,
    })
    .then((resp) => {
      if (resp.code === 0) {
        ElMessage.success({
          message: resp.message,
        });
        getTaskList();
      }
    });
};

// Delete task
const deleteTask = (id) => {
  ElMessageBox.confirm($t('hiveTasks.del'), $t('dialog.confirm'), {
    confirmButtonText: $t('form.confirm'),
    cancelButtonText: $t('form.cancel'),
    type: 'warning',
  }).then(() => {
    axios
      .delete('/devices/tasks', {
        data: {
          task_ids: [id],
        },
      })
      .then((resp) => {
        if (resp.code === 0) {
          ElMessage.success({
            message: resp.message,
          });
          getTaskList();
        }
      });
  });
};

// Open dialog for creating/editing task
const openTaskDialog = (id = null) => {
  taskForm.value = defaultTaskForm;
  if (id) {
    getTaskInfo(id);
  }
  dialogVisible.value = true;
};

// Submit task form
const submitTask = () => {
  updateTask.value.validate((valid) => {
    if (valid) {
      // Prepare task data based on task type
      let taskData = {};

      if (taskForm.value.task_name === 'publish_video') {
        // For publish_video tasks, only include non-null fields
        taskData = {
          app_number: taskForm.value.task_data.app_number,
          video_path: taskForm.value.task_data.video_path,
          description: taskForm.value.task_data.description,
        };
        // Add account_name only if it's not empty
        if (taskForm.value.task_data.account_name) {
          taskData.account_name = taskForm.value.task_data.account_name;
        }
      } else if (taskForm.value.task_name === 'unknown') {
        // For unknown tasks, task_data should be null
        taskData = null;
      } else {
        // For unknown tasks, task_data should be null
        taskData = null;
      }

      // For creating new tasks
      if (!taskForm.value.id) {
        const requestData = {
          device_label: taskForm.value.device_label,
          device_id: taskForm.value.device_id,
          task_name: taskForm.value.task_name,
          cron_time: taskForm.value.cron_time,
        };

        // Add task_data only if it's not null
        if (taskData !== null) {
          requestData.task_data = taskData;
        }

        axios.post('/devices/tasks', { data: [requestData] }).then((resp) => {
          if (resp.code === 0) {
            ElMessage.success({
              message: resp.message,
            });
            dialogVisible.value = false;
            getTaskList();
          }
        });
      } else {
        // For updating existing tasks
        const requestData = {
          device_label: taskForm.value.device_label,
          device_id: taskForm.value.device_id,
          task_name: taskForm.value.task_name,
          cron_time: taskForm.value.cron_time,
          status: taskForm.value.status,
        };

        // Add task_data only if it's not null
        if (taskData !== null) {
          requestData.task_data = taskData;
        }

        axios
          .put(`/devices/tasks/${taskForm.value.id}`, requestData)
          .then((resp) => {
            if (resp.code === 0) {
              ElMessage.success({
                message: resp.message,
              });
              dialogVisible.value = false;
              getTaskList();
            }
          });
      }
    }
  });
};

// Search tasks
const searchTasks = () => {
  pageCurrNum.value = 1;
  getTaskList();
};

// Reset search form
const resetSearch = () => {
  searchForm.value = {
    id: '',
    device_id: '',
    task_name: '',
    status: null,
    cron_time_start: '',
    cron_time_end: '',
    addtime_start: '',
    addtime_end: '',
  };
  searchTasks();
};

onMounted(() => {
  getTaskList();
});
</script>

<template>
  <!-- Task Data Dialog -->
  <el-dialog
    v-model="taskDataDialog"
    :title="$t('hiveTasks.taskData')"
    width="600px"
  >
    <pre>{{ JSON.stringify(currentTaskData, null, 2) }}</pre>
  </el-dialog>

  <el-dialog
    v-model="dialogVisible"
    :title="$t('jobsTS.dialogVisible.message')"
    width="600px"
  >
    <el-form
      ref="updateTask"
      :model="taskForm"
      size="small"
      class="demo-table-expand"
      label-width="120px"
      label-position="left"
    >
      <el-form-item
        prop="device_label"
        :label="$t('hiveTasks.deviceLabel')"
        :rules="{
          required: true,
          message: 'Device label is required',
          trigger: 'blur',
        }"
      >
        <el-input
          v-model="taskForm.device_label"
          placeholder="Enter device label"
          @blur="fetchDeviceUDID(taskForm.device_label)"
        ></el-input>
      </el-form-item>
      <el-form-item
        prop="device_id"
        :label="$t('hiveTasks.deviceId')"
        :rules="{
          required: true,
          message: 'Device ID is required',
          trigger: 'blur',
        }"
      >
        <el-input
          v-model="taskForm.device_id"
          placeholder="Enter device ID"
        ></el-input>
      </el-form-item>
      <el-form-item
        prop="task_name"
        :label="$t('hiveTasks.taskName')"
        :rules="{
          required: true,
          message: $t('jobsTS.dialogVisible.nameIsNull'),
          trigger: 'blur',
        }"
      >
        <el-select
          v-model="taskForm.task_name"
          placeholder="Select task name"
          style="width: 100%"
        >
          <el-option label="Publish Video" value="publish_video"></el-option>
          <el-option label="Unknown" value="unknown"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item
        prop="cron_time"
        :label="$t('hiveTasks.cron_time')"
        :rules="{
          required: true,
          message: $t('jobsTS.dialogVisible.cronIsNull'),
          trigger: 'blur',
        }"
      >
        <el-date-picker
          v-model="taskForm.cron_time"
          type="datetime"
          :placeholder="$t('hiveTasks.cron_time')"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="X"
          style="min-width: 180px"
        />
      </el-form-item>
      <el-form-item prop="status" :label="$t('hiveTasks.status')">
        <el-select
          v-model="taskForm.status"
          :placeholder="$t('hiveTasks.status')"
        >
          <el-option
            v-for="(value, index) in STATUS_MAP"
            :key="index"
            :label="value"
            :value="Number(index)"
          />
        </el-select>
      </el-form-item>
      <!-- Task Data Fields -->
      <el-form-item
        v-if="taskForm.task_name === 'publish_video'"
        :label="$t('hiveTasks.app_number')"
        prop="task_data.app_number"
      >
        <el-select
          v-model="taskForm.task_data.app_number"
          placeholder="Select app number"
          style="width: 100%"
        >
          <el-option label="1" :value="1"></el-option>
          <el-option label="2" :value="2"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item
        v-if="taskForm.task_name === 'publish_video'"
        :label="$t('hiveTasks.account_name')"
        prop="task_data.account_name"
      >
        <el-input
          v-model="taskForm.task_data.account_name"
          placeholder="Enter account name (optional)"
        ></el-input>
      </el-form-item>
      <el-form-item
        v-if="taskForm.task_name === 'publish_video'"
        :label="$t('hiveTasks.video_path')"
        prop="task_data.video_path"
        :rules="{
          required: taskForm.task_name === 'publish_video',
          message: 'Video path is required for publish_video task',
          trigger: 'blur',
        }"
      >
        <el-input
          v-model="taskForm.task_data.video_path"
          placeholder="Enter video path"
        ></el-input>
      </el-form-item>
      <el-form-item
        v-if="taskForm.task_name === 'publish_video'"
        :label="$t('hiveTasks.description')"
        prop="task_data.description"
        :rules="{
          required: taskForm.task_name === 'publish_video',
          message: 'Description is required for publish_video task',
          trigger: 'blur',
        }"
      >
        <el-input
          v-model="taskForm.task_data.description"
          placeholder="Enter Description"
        ></el-input>
      </el-form-item>
    </el-form>
    <div style="text-align: center">
      <el-button size="small" type="primary" @click="submitTask">{{
        $t('form.confirm')
      }}</el-button>
    </div>
  </el-dialog>
  <el-button size="mini" round type="primary" @click="openTaskDialog()">{{
    $t('jobsTS.addCron')
  }}</el-button>

  <!-- Search Form -->
  <el-form
    :inline="true"
    :model="searchForm"
    class="demo-form-inline"
    style="margin-top: 20px"
  >
    <el-form-item :label="$t('hiveTasks.taskId')">
      <el-input
        v-model="searchForm.id"
        :placeholder="$t('hiveTasks.taskId')"
        style="width: 120px"
      ></el-input>
    </el-form-item>
    <el-form-item :label="$t('hiveTasks.deviceId')">
      <el-input
        v-model="searchForm.device_id"
        :placeholder="$t('hiveTasks.deviceId')"
        style="min-width: 120px"
      ></el-input>
    </el-form-item>
    <el-form-item :label="$t('hiveTasks.taskName')">
      <el-select
        v-model="searchForm.task_name"
        :placeholder="$t('hiveTasks.taskName')"
        style="width: 150px"
        clearable
      >
        <el-option label="Publish Video" value="publish_video"></el-option>
        <el-option label="Unknown" value="unknown"></el-option>
      </el-select>
    </el-form-item>
    <el-form-item :label="$t('hiveTasks.status')">
      <el-select
        v-model="searchForm.status"
        :placeholder="$t('hiveTasks.status')"
        style="width: 150px"
        clearable
      >
        <el-option
          v-for="(value, index) in STATUS_MAP"
          :key="index"
          :label="value"
          :value="Number(index)"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="$t('hiveTasks.cron_time')">
      <el-date-picker
        v-model="searchForm.cron_time_start"
        type="datetime"
        :placeholder="$t('hiveTasks.cron_time')"
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        style="min-width: 180px"
      />
      <span> - </span>
      <el-date-picker
        v-model="searchForm.cron_time_end"
        type="datetime"
        :placeholder="$t('hiveTasks.cron_time')"
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        style="min-width: 180px"
      />
    </el-form-item>
    <el-form-item :label="$t('hiveTasks.addtime')">
      <el-date-picker
        v-model="searchForm.addtime_start"
        type="datetime"
        :placeholder="$t('hiveTasks.addtime')"
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        style="min-width: 180px"
      />
      <span> - </span>
      <el-date-picker
        v-model="searchForm.addtime_end"
        type="datetime"
        :placeholder="$t('hiveTasks.addtime')"
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        style="min-width: 180px"
      />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="searchTasks">{{
        $t('form.search')
      }}</el-button>
      <el-button @click="resetSearch">{{ $t('form.reset') }}</el-button>
    </el-form-item>
  </el-form>
  <el-table
    :data="pageData['content']"
    style="width: 100%; margin-top: 20px"
    border
  >
    <el-table-column
      :label="$t('hiveTasks.taskId')"
      width="80"
      align="center"
      prop="id"
    ></el-table-column>
    <el-table-column
      :label="$t('hiveTasks.deviceLabel')"
      width="120"
      align="center"
      prop="device_label"
    ></el-table-column>
    <el-table-column
      :label="$t('hiveTasks.deviceId')"
      width="120"
      align="center"
      prop="device_id"
    ></el-table-column>
    <el-table-column
      :label="$t('hiveTasks.taskName')"
      width="150"
      align="center"
      prop="task_name"
    ></el-table-column>
    <el-table-column
      :label="$t('hiveTasks.taskData')"
      width="120"
      align="center"
      prop="task_data"
    >
      <template #default="scope">
        <el-button
          v-if="
            scope.row.task_data && Object.keys(scope.row.task_data).length > 0
          "
          size="mini"
          @click="showTaskData(scope.row.task_data)"
        >
          {{ scope.row.task_data?.account_name || 'View Data' }}
        </el-button>
        <span v-else>N/A</span>
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('hiveTasks.status')"
      min-width="120"
      align="center"
    >
      <template #default="{ row }">
        <el-tag :type="statusTagType(row.status)">{{
          statusLabel(row.status)
        }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('hiveTasks.result')"
      min-width="120"
      align="center"
      prop="result"
    >
      <template #default="scope">
        <span v-if="scope.row.status === 2">{{ scope.row.result }}</span>
        <span v-else></span>
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('hiveTasks.cron_time')"
      min-width="100"
      align="center"
      prop="cron_time"
    >
      <template #default="scope">
        {{ formatTimestamp(scope.row.cron_time) }}
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('hiveTasks.finished_time')"
      min-width="100"
      align="center"
      prop="finished_time"
    >
      <template #default="scope">
        {{ formatTimestamp(scope.row.finished_time) }}
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('hiveTasks.addtime')"
      min-width="100"
      align="center"
      prop="addtime"
    >
      <template #default="scope">
        {{ formatTimestamp(scope.row.addtime) }}
      </template>
    </el-table-column>
    <el-table-column :label="$t('common.operate')" width="290" align="center">
      <template #default="scope">
        <el-button
          type="primary"
          size="mini"
          @click="openTaskDialog(scope.row.id)"
          >{{ $t('common.edit') }}
        </el-button>
        <el-button
          style="margin-left: 10px"
          type="danger"
          size="mini"
          icon="el-icon-warning"
          icon-color="red"
          @click="deleteTask(scope.row.id)"
          >{{ $t('common.delete') }}
        </el-button>
      </template>
    </el-table-column>
  </el-table>
  <pageable
    :is-page-set="true"
    :total="pageData['totalElements']"
    :current-page="pageData['number'] + 1"
    :page-size="pageData['size']"
    @change="getTaskList"
  ></pageable>
</template>
