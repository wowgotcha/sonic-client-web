<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { $hiveHttp as axios } from '../http/axios';
import Pageable from '../components/Pageable.vue';

const { t: $t } = useI18n();

const route = useRoute();
const dialogVisible = ref(false);
const pageData = ref({});
const pageSize = ref(15);
const pageCurrNum = ref(1);
const updateTask = ref(null);
const taskForm = ref({
  id: null,
  device_id: '',
  task_name: '',
  task_data: {
    app_number: null,
    account_name: '',
    video_path: '',
  },
  cron_time: null,
  status: 0, // 0: not started (default)
});

const searchForm = ref({
  id: '',
  device_id: '',
  task_name: '',
  status: null,
});
const taskDataDialog = ref(false);
const currentTaskData = ref({});

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
    const data = resp.data.tasks || resp.data.tasks[0];
    taskForm.value = {
      id: data.id,
      device_id: data.device_id,
      task_name: data.task_name,
      task_data: {
        app_number: null,
        account_name: '',
        video_path: '',
      },
      cron_time: data.cron_time,
      status: data.status,
    };

    // Populate task_data fields based on task_name
    if (data.task_name === 'publish_video' && data.task_data) {
      taskForm.value.task_data.app_number = data.task_data.app_number || null;
      taskForm.value.task_data.account_name = data.task_data.account_name || '';
      taskForm.value.task_data.video_path = data.task_data.video_path || '';
    }
  });
};

// Update task status
const updateStatus = (id, status) => {
  // Validate status value
  if (![0, 1, 2, 3].includes(status)) {
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
  ElMessageBox.confirm($t('jobsTS.del'), $t('dialog.confirm'), {
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
  taskForm.value = {
    id: null,
    device_id: route.params.projectId,
    task_name: '',
    task_data: {
      app_number: null,
      account_name: '',
      video_path: '',
    },
    cron_time: null,
    status: 0, // Default to not started
  };
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
        };
        // Add account_name only if it's not empty
        if (taskForm.value.task_data.account_name) {
          taskData.account_name = taskForm.value.task_data.account_name;
        }
      } else if (taskForm.value.task_name === 'unknown') {
        // For unknown tasks, task_data should be null
        taskData = null;
      } else {
        // For other task types, use the task_data as is
        taskData = taskForm.value.task_data;
      }

      // For creating new tasks
      if (!taskForm.value.id) {
        const requestData = {
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
  };
  searchTasks();
};

onMounted(() => {
  getTaskList();
});
</script>

<template>
  <!-- Task Data Dialog -->
  <el-dialog v-model="taskDataDialog" title="Task Data" width="600px">
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
        prop="device_id"
        label="Device ID"
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
        :label="$t('jobsTS.dialogVisible.name')"
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
        :label="$t('jobsTS.dialogVisible.cron')"
        :rules="{
          required: true,
          message: $t('jobsTS.dialogVisible.cronIsNull'),
          trigger: 'blur',
        }"
      >
        <el-input
          v-model="taskForm.cron_time"
          :placeholder="$t('jobsTS.dialogVisible.inputCron')"
        ></el-input>
      </el-form-item>
      <el-form-item prop="status" :label="$t('agent.status.name')">
        <el-select v-model="taskForm.status" placeholder="Select status">
          <el-option label="Not Started" :value="0"></el-option>
          <el-option label="Running" :value="1"></el-option>
          <el-option label="Finished" :value="2"></el-option>
          <el-option label="Failed" :value="3"></el-option>
        </el-select>
      </el-form-item>
      <!-- Task Data Fields -->
      <el-form-item
        v-if="taskForm.task_name === 'publish_video'"
        label="App Number"
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
        label="Account Name"
        prop="task_data.account_name"
      >
        <el-input
          v-model="taskForm.task_data.account_name"
          placeholder="Enter account name (optional)"
        ></el-input>
      </el-form-item>
      <el-form-item
        v-if="taskForm.task_name === 'publish_video'"
        label="Video Path"
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
    <el-form-item label="Task ID">
      <el-input
        v-model="searchForm.id"
        placeholder="Task ID"
        style="width: 120px"
      ></el-input>
    </el-form-item>
    <el-form-item label="Device ID">
      <el-input
        v-model="searchForm.device_id"
        placeholder="Device ID"
        style="width: 120px"
      ></el-input>
    </el-form-item>
    <el-form-item label="Task Name">
      <el-select
        v-model="searchForm.task_name"
        placeholder="Task Name"
        style="width: 120px"
        clearable
      >
        <el-option label="Publish Video" value="publish_video"></el-option>
        <el-option label="Unknown" value="unknown"></el-option>
      </el-select>
    </el-form-item>
    <el-form-item label="Status">
      <el-select
        v-model="searchForm.status"
        placeholder="Status"
        style="width: 120px"
        clearable
      >
        <el-option label="Not Started" :value="0"></el-option>
        <el-option label="Running" :value="1"></el-option>
        <el-option label="Finished" :value="2"></el-option>
        <el-option label="Failed" :value="3"></el-option>
      </el-select>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="searchTasks">Search</el-button>
      <el-button @click="resetSearch">Reset</el-button>
    </el-form-item>
  </el-form>
  <el-table
    :data="pageData['content']"
    style="width: 100%; margin-top: 20px"
    border
  >
    <el-table-column
      :label="$t('jobsTS.taskId')"
      width="80"
      align="center"
      prop="id"
    ></el-table-column>
    <el-table-column
      label="Device ID"
      width="120"
      align="center"
      prop="device_id"
    ></el-table-column>
    <el-table-column
      :label="$t('jobsTS.dialogVisible.name')"
      width="150"
      align="center"
      prop="task_name"
    ></el-table-column>
    <el-table-column
      label="Task Data"
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
          View Data
        </el-button>
        <span v-else>N/A</span>
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('agent.status.name')"
      width="120"
      align="center"
    >
      <template #default="scope">
        <el-tag v-if="scope.row.status === 0" type="info">Not Started</el-tag>
        <el-tag v-else-if="scope.row.status === 1" type="warning"
          >Running</el-tag
        >
        <el-tag v-else-if="scope.row.status === 2" type="success"
          >Finished</el-tag
        >
        <el-tag v-else-if="scope.row.status === 3" type="danger">Failed</el-tag>
        <el-tag v-else type="info">Unknown</el-tag>
      </template>
    </el-table-column>
    <el-table-column
      label="Result"
      width="120"
      align="center"
      prop="result"
    ></el-table-column>
    <el-table-column
      :label="$t('jobsTS.dialogVisible.cron')"
      width="120"
      header-align="center"
      prop="cron_time"
    ></el-table-column>
    <el-table-column
      label="Finished Time"
      width="120"
      align="center"
      prop="finished_time"
    ></el-table-column>
    <el-table-column
      label="Add Time"
      width="120"
      align="center"
      prop="addtime"
    ></el-table-column>
    <el-table-column :label="$t('common.operate')" width="290" align="center">
      <template #default="scope">
        <el-button
          type="success"
          size="mini"
          @click="updateStatus(scope.row.id, 1)"
          >{{ $t('jobsTS.run') }}
        </el-button>
        <el-button
          type="primary"
          size="mini"
          @click="openTaskDialog(scope.row.id)"
          >{{ $t('common.edit') }}
        </el-button>
        <el-popconfirm
          style="margin-left: 10px"
          :confirm-button-text="$t('form.confirm')"
          :cancel-button-text="$t('form.cancel')"
          icon="el-icon-warning"
          icon-color="red"
          :title="$t('jobsTS.del')"
          @confirm="deleteTask(scope.row.id)"
        >
          <template #reference>
            <el-button type="danger" size="mini"
              >{{ $t('common.delete') }}
            </el-button>
          </template>
        </el-popconfirm>
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
