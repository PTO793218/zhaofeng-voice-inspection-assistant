export type InspectionSource = 'TF13'

export interface InspectionItem {
  detailGuid: string
  sequence: number
  itemNo: string
  name: string
  requirement: string
  min: number | null
  max: number | null
  values: Array<string | null>
}

export interface InspectionRecord {
  source: InspectionSource
  masterGuid: string
  taskGuid: string
  taskNo: string
  parent: string
  product: string
  productName: string
  process: string
  recordTime: string
  checkType: string
  result: string
  items: InspectionItem[]
}

export interface InspectionTaskSample {
  parent: string
  rjhguid: string
  product: string
  name: string
  process: string
  workshop: string
  line: string
  plan: number
  done: number
  scrap: number
  unit: string
  status: '关闭'
  date: string
  inspectionSample: true
}

export type MeasurementParseResult =
  | { status: 'ready'; detailGuid: string; itemName: string; column: number; value: string }
  | { status: 'incomplete'; reason: string }
  | { status: 'invalid'; reason: string }

export const INSPECTION_RECORDS: InspectionRecord[] = [
  {
    "source": "TF13",
    "masterGuid": "44e3fcbb-8933-4ebd-a4c6-1baa3344657f",
    "taskGuid": "700b3ae9-2bab-46f6-a2c4-ccfab0c5e026",
    "taskNo": "GP22010401-6",
    "parent": "GP22010401",
    "product": "2CHC0100358",
    "productName": "车件HZF707BR-3B-C01",
    "process": "C-007",
    "recordTime": "2022-08-31 15:00:17",
    "checkType": "checker_check",
    "result": "OK",
    "items": [
      {
        "detailGuid": "b65586ed-1846-4bc4-8ce5-541809f18e7e",
        "sequence": 1,
        "itemNo": "JYXM0096",
        "name": "外径D1",
        "requirement": "φ87.4(-0.05～0)",
        "min": 87.35,
        "max": 87.4,
        "values": [
          "87.36",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "320e3060-ceec-4fb2-911c-f8f52dfb6d13",
        "sequence": 2,
        "itemNo": "JYXM0235",
        "name": "外径D2",
        "requirement": "φ93(-0.04～-0.01)",
        "min": 92.96,
        "max": 92.99,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "8734100c-c12b-4fcd-a089-9b937d876ff5",
        "sequence": 3,
        "itemNo": "JYXM0098",
        "name": "内径d1",
        "requirement": "φ81.7(-0.04～0.01)",
        "min": 81.66,
        "max": 81.71,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "c2b93dd0-56a3-488b-9caa-918e957f2a12",
        "sequence": 4,
        "itemNo": "JYXM0238",
        "name": "内径d2",
        "requirement": "φ78.3(-0.04～0.01)",
        "min": 78.26,
        "max": 78.31,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "b8ba2c04-8b71-4ea6-8950-1bb603710c34",
        "sequence": 5,
        "itemNo": "JYXMCC488",
        "name": "沟径De",
        "requirement": "φ78.86(-0.05～0)",
        "min": 78.81,
        "max": 78.86,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "f69f5daa-966a-4202-a0d2-f824be4948a6",
        "sequence": 6,
        "itemNo": "JYXMCC489",
        "name": "沟位ae1",
        "requirement": "11.94(-0.06~-0.02)",
        "min": 11.88,
        "max": 11.92,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "d39c613b-3472-42fb-88c3-9a3d27978968",
        "sequence": 7,
        "itemNo": "JYXMCC490",
        "name": "沟位ae2",
        "requirement": "33.3(0.02~0.06)",
        "min": 33.32,
        "max": 33.36,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "a5d4e7a9-429e-4379-a587-62961690890e",
        "sequence": 8,
        "itemNo": "JYXM0330",
        "name": "沟曲率R",
        "requirement": "6.03(0~0.04)",
        "min": 6.03,
        "max": 6.07,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "f535830a-a657-4981-bfda-e689054452bc",
        "sequence": 9,
        "itemNo": "JYXM472",
        "name": "总高H1",
        "requirement": "45.3(0~0.03)",
        "min": 45.3,
        "max": 45.6,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "6a40d54b-4339-4855-8e0b-f785689e66d2",
        "sequence": 10,
        "itemNo": "JYXM0085",
        "name": "台阶高度H2",
        "requirement": "17.4(-0.03~0)",
        "min": 17.37,
        "max": 17.4,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "e4897c2e-a039-41d3-9a1a-9fff64b50260",
        "sequence": 11,
        "itemNo": "JYXM454",
        "name": "法兰厚度L",
        "requirement": "15.4±0.20",
        "min": 15.2,
        "max": 15.6,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "9721a08e-5988-4200-b1d2-09c0210d9928",
        "sequence": 12,
        "itemNo": "JYXM0352",
        "name": "外径椭圆VDp",
        "requirement": "≤0.015",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "5338969e-fcfa-4868-9801-c6da8e8314fe",
        "sequence": 13,
        "itemNo": "JYXM0341",
        "name": "内径椭圆Vdp",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "bbbb1ca3-f685-4c02-af8a-a79d62dc9074",
        "sequence": 14,
        "itemNo": "JYXM0329",
        "name": "沟径椭圆Vdip",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "2920a99f-c9f7-402b-a976-cb20a78f187d",
        "sequence": 15,
        "itemNo": "JYXM0325",
        "name": "沟摆Si",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "7ca33e5c-75bf-4a97-bc1f-61f00a90abf5",
        "sequence": 16,
        "itemNo": "JYXMCC427",
        "name": "平行差c",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "896c17a5-00d5-46fc-8327-05eeff759c5e",
        "sequence": 17,
        "itemNo": "JYXM0090",
        "name": "同心度",
        "requirement": "≤0.05",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "fe5f9a70-570b-412c-867a-9d1de27e01be",
        "sequence": 18,
        "itemNo": "JYXMCC476",
        "name": "平面度",
        "requirement": "凹≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "577e3a9c-41d3-4289-9759-ddc97ef3938e",
        "sequence": 19,
        "itemNo": "JYXM0145",
        "name": "Ra 表面粗糙度",
        "requirement": "≤1.6μm",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "eb4a5bb8-a9a5-410b-965b-91de557a9a5d",
        "sequence": 20,
        "itemNo": "JYXM0091",
        "name": "外观",
        "requirement": "无磕碰伤和料废",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      }
    ]
  },
  {
    "source": "TF13",
    "masterGuid": "94c5c79d-9dc4-45a6-8aa6-f689cecf2573",
    "taskGuid": "d2be7224-6e88-4e9b-ab95-d3feb49fc683",
    "taskNo": "GP21122470-6",
    "parent": "GP21122470",
    "product": "2MHM0101092",
    "productName": "HZF707BR-3B(GEC)-01",
    "process": "M-061",
    "recordTime": "2022-12-07 22:23:19",
    "checkType": "worker_check",
    "result": "OK",
    "items": [
      {
        "detailGuid": "76dc129d-a107-443d-9fa3-af73a575bab6",
        "sequence": 1,
        "itemNo": "JYXM0096",
        "name": "外径D1",
        "requirement": "",
        "min": 88.35,
        "max": 88.45,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "90f92249-5c62-4168-8a02-bbbed96e6bb8",
        "sequence": 2,
        "itemNo": "JYXM0236",
        "name": "外径D3",
        "requirement": "",
        "min": 94.35,
        "max": 95.35,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      }
    ]
  },
  {
    "source": "TF13",
    "masterGuid": "36e4e439-569f-4d47-9422-ee37cece7601",
    "taskGuid": "7b20668d-a5f7-42a6-824d-6913603b90e4",
    "taskNo": "GP22010599-6",
    "parent": "GP22010599",
    "product": "2CHC0100358",
    "productName": "车件HZF707BR-3B-C01",
    "process": "C-007",
    "recordTime": "2022-12-08 17:06:59",
    "checkType": "worker_check",
    "result": "OK",
    "items": [
      {
        "detailGuid": "78af8b24-b7da-4ddb-9bef-366af62a8c9c",
        "sequence": 1,
        "itemNo": "JYXM0096",
        "name": "外径D1",
        "requirement": "φ87.4(-0.05～0)",
        "min": 87.35,
        "max": 87.4,
        "values": [
          "87.38",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "0c52a160-f2f2-47a0-824f-b6a86ce6df17",
        "sequence": 2,
        "itemNo": "JYXM0235",
        "name": "外径D2",
        "requirement": "φ93(-0.04～-0.01)",
        "min": 92.96,
        "max": 92.99,
        "values": [
          "92.98",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "b18f0ddb-3a8e-491b-9aed-097294ed0709",
        "sequence": 3,
        "itemNo": "JYXM0098",
        "name": "内径d1",
        "requirement": "φ81.7(-0.04～0.01)",
        "min": 81.66,
        "max": 81.71,
        "values": [
          "81.69",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "55ed499c-3c24-4fc8-b698-b55726b1e7f6",
        "sequence": 4,
        "itemNo": "JYXM0238",
        "name": "内径d2",
        "requirement": "φ78.3(-0.04～0.01)",
        "min": 78.26,
        "max": 78.31,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "ef97127c-c8fc-4c40-b10d-3368658846c3",
        "sequence": 5,
        "itemNo": "JYXMCC488",
        "name": "沟径De",
        "requirement": "φ78.86(-0.05～0)",
        "min": 78.81,
        "max": 78.86,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "e510b9e3-7aba-4c8a-9903-def8cf2b3822",
        "sequence": 6,
        "itemNo": "JYXMCC489",
        "name": "沟位ae1",
        "requirement": "11.94(-0.06~-0.02)",
        "min": 11.88,
        "max": 11.92,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "6644bdcc-19cc-41ad-ba95-cc4b06bb05a7",
        "sequence": 7,
        "itemNo": "JYXMCC490",
        "name": "沟位ae2",
        "requirement": "33.3(0.02~0.06)",
        "min": 33.32,
        "max": 33.36,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "236d5501-ee3d-47fb-9eef-9f59e0b2d72c",
        "sequence": 8,
        "itemNo": "JYXM0330",
        "name": "沟曲率R",
        "requirement": "6.03(0~0.04)",
        "min": 6.03,
        "max": 6.07,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "5610965c-2a58-4451-9eb2-ee35773dbcdb",
        "sequence": 9,
        "itemNo": "JYXM472",
        "name": "总高H1",
        "requirement": "45.3(0~0.03)",
        "min": 45.3,
        "max": 45.6,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "8e4c38dd-4490-401c-9bbd-98dccf60e6bc",
        "sequence": 10,
        "itemNo": "JYXM0085",
        "name": "台阶高度H2",
        "requirement": "17.4(-0.03~0)",
        "min": 17.37,
        "max": 17.4,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "cb369617-3b5b-4849-b9f5-2e090c37e79c",
        "sequence": 11,
        "itemNo": "JYXM454",
        "name": "法兰厚度L",
        "requirement": "15.4±0.20",
        "min": 15.2,
        "max": 15.6,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "17b119b6-0e1a-40cd-aa9a-66643a2c6258",
        "sequence": 12,
        "itemNo": "JYXM0352",
        "name": "外径椭圆VDp",
        "requirement": "≤0.015",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "141e4694-7a31-4e70-9a97-5018c28370ea",
        "sequence": 13,
        "itemNo": "JYXM0341",
        "name": "内径椭圆Vdp",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "f2f57064-9192-49b0-9c6a-5a7a4f9d5f5a",
        "sequence": 14,
        "itemNo": "JYXM0329",
        "name": "沟径椭圆Vdip",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "8d9593f5-e31c-4091-b8b1-4daf27b4db9b",
        "sequence": 15,
        "itemNo": "JYXM0325",
        "name": "沟摆Si",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "a6751e07-72ab-4a8e-99f8-e233702024d9",
        "sequence": 16,
        "itemNo": "JYXMCC427",
        "name": "平行差c",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "38860b82-8b80-43ce-9ef1-1a7b64fea597",
        "sequence": 17,
        "itemNo": "JYXM0090",
        "name": "同心度",
        "requirement": "≤0.05",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "78146d3f-7373-4eab-a086-090541186e4c",
        "sequence": 18,
        "itemNo": "JYXMCC476",
        "name": "平面度",
        "requirement": "凹≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "3f660699-0d82-449a-bf72-fc1e379d35e6",
        "sequence": 19,
        "itemNo": "JYXM0145",
        "name": "Ra 表面粗糙度",
        "requirement": "≤1.6μm",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "f7bb1dfd-e9f9-40ff-a7db-c6db9577d8f8",
        "sequence": 20,
        "itemNo": "JYXM0091",
        "name": "外观",
        "requirement": "无磕碰伤和料废",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      }
    ]
  },
  {
    "source": "TF13",
    "masterGuid": "1fa88f8c-30a2-4bfc-b01d-96253ff92a08",
    "taskGuid": "a5c03c77-36b7-4403-a89c-2247050140db",
    "taskNo": "GP21122470-4",
    "parent": "GP21122470",
    "product": "2MHM0101092",
    "productName": "HZF707BR-3B(GEC)-01",
    "process": "M-045",
    "recordTime": "2022-12-07 22:23:19",
    "checkType": "worker_check",
    "result": "OK",
    "items": [
      {
        "detailGuid": "9399c1e9-14f2-4dea-b61a-1e1fe0ad1a33",
        "sequence": 1,
        "itemNo": "JYXM0096",
        "name": "外径D1",
        "requirement": "",
        "min": 88.35,
        "max": 88.45,
        "values": [
          "88.35",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "3336f6c5-8944-423f-b7f4-3d29414d6b02",
        "sequence": 2,
        "itemNo": "JYXMC478",
        "name": "外径D3",
        "requirement": "",
        "min": 94.35,
        "max": 95.35,
        "values": [
          "95.01",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      }
    ]
  },
  {
    "source": "TF13",
    "masterGuid": "300d0abe-6f33-4d6e-951e-c05caf9c5287",
    "taskGuid": "d3b82325-34bf-4045-a2fd-1612549586fd",
    "taskNo": "GP21122470-5",
    "parent": "GP21122470",
    "product": "2MHM0101092",
    "productName": "HZF707BR-3B(GEC)-01",
    "process": "M-013",
    "recordTime": "2022-12-07 22:23:19",
    "checkType": "worker_check",
    "result": "OK",
    "items": [
      {
        "detailGuid": "2a9e8a6d-ac66-43f0-be51-bcaf09efdd5b",
        "sequence": 1,
        "itemNo": "JYXM0096",
        "name": "外径D1",
        "requirement": "",
        "min": 88.35,
        "max": 88.45,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "5e1f5b0e-a19b-4778-a1fc-cbf3389e08a7",
        "sequence": 2,
        "itemNo": "JYXM0236",
        "name": "外径D3",
        "requirement": "",
        "min": 94.35,
        "max": 95.35,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      }
    ]
  },
  {
    "source": "TF13",
    "masterGuid": "cc8f2c64-7611-496c-90cf-6c16801cf2b2",
    "taskGuid": "700b3ae9-2bab-46f6-a2c4-ccfab0c5e026",
    "taskNo": "GP22010401-6",
    "parent": "GP22010401",
    "product": "2CHC0100358",
    "productName": "车件HZF707BR-3B-C01",
    "process": "C-007",
    "recordTime": "2022-08-31 15:31:50",
    "checkType": "checker_check",
    "result": "OK",
    "items": [
      {
        "detailGuid": "f66278de-741b-4f32-839a-ff9b6acb19e2",
        "sequence": 1,
        "itemNo": "JYXM0096",
        "name": "外径D1",
        "requirement": "φ87.4(-0.05～0)",
        "min": 87.35,
        "max": 87.4,
        "values": [
          "87.36",
          "87.39",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "79955b54-4ccf-4de6-a3ef-2786f634d541",
        "sequence": 2,
        "itemNo": "JYXM0235",
        "name": "外径D2",
        "requirement": "φ93(-0.04～-0.01)",
        "min": 92.96,
        "max": 92.99,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "a7ce9184-398d-4030-bf00-ce42dafd1db9",
        "sequence": 3,
        "itemNo": "JYXM0098",
        "name": "内径d1",
        "requirement": "φ81.7(-0.04～0.01)",
        "min": 81.66,
        "max": 81.71,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "58048989-ed97-4bdb-81ea-073b204e4826",
        "sequence": 4,
        "itemNo": "JYXM0238",
        "name": "内径d2",
        "requirement": "φ78.3(-0.04～0.01)",
        "min": 78.26,
        "max": 78.31,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "2e2bfb81-aa1c-403f-8a31-bf3e3f5e1df5",
        "sequence": 5,
        "itemNo": "JYXMCC488",
        "name": "沟径De",
        "requirement": "φ78.86(-0.05～0)",
        "min": 78.81,
        "max": 78.86,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "5d616486-1322-4958-a8ec-55749cfc8cf9",
        "sequence": 6,
        "itemNo": "JYXMCC489",
        "name": "沟位ae1",
        "requirement": "11.94(-0.06~-0.02)",
        "min": 11.88,
        "max": 11.92,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "8af8b3be-0837-47b6-af3e-bb1d6086f570",
        "sequence": 7,
        "itemNo": "JYXMCC490",
        "name": "沟位ae2",
        "requirement": "33.3(0.02~0.06)",
        "min": 33.32,
        "max": 33.36,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "a33db7f8-78f4-4d05-ba0f-5c43d97f8e13",
        "sequence": 8,
        "itemNo": "JYXM0330",
        "name": "沟曲率R",
        "requirement": "6.03(0~0.04)",
        "min": 6.03,
        "max": 6.07,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "1d44765c-bbd5-4157-956e-f3f2c25e5b43",
        "sequence": 9,
        "itemNo": "JYXM472",
        "name": "总高H1",
        "requirement": "45.3(0~0.03)",
        "min": 45.3,
        "max": 45.6,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "be9c4750-a862-4e54-a168-094f18485485",
        "sequence": 10,
        "itemNo": "JYXM0085",
        "name": "台阶高度H2",
        "requirement": "17.4(-0.03~0)",
        "min": 17.37,
        "max": 17.4,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "f37020c1-cb85-4c4a-857e-4ad6ce74f844",
        "sequence": 11,
        "itemNo": "JYXM454",
        "name": "法兰厚度L",
        "requirement": "15.4±0.20",
        "min": 15.2,
        "max": 15.6,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "7174e36f-33a1-4bcd-b629-ec99453d16b6",
        "sequence": 12,
        "itemNo": "JYXM0352",
        "name": "外径椭圆VDp",
        "requirement": "≤0.015",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "53dc487d-1764-42e0-b9d3-885b22f7e793",
        "sequence": 13,
        "itemNo": "JYXM0341",
        "name": "内径椭圆Vdp",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "82bfcca4-f6ae-4dc4-b8f3-2614c2811cae",
        "sequence": 14,
        "itemNo": "JYXM0329",
        "name": "沟径椭圆Vdip",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "45ad3827-cb41-4c3b-b802-285bd6188c37",
        "sequence": 15,
        "itemNo": "JYXM0325",
        "name": "沟摆Si",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "2e07f944-086f-44ef-a679-360786b29044",
        "sequence": 16,
        "itemNo": "JYXMCC427",
        "name": "平行差c",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "04afad06-a44b-4bc8-b604-82a6abeb4c21",
        "sequence": 17,
        "itemNo": "JYXM0090",
        "name": "同心度",
        "requirement": "≤0.05",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "8f8dec0e-cd1a-411e-b81d-a8cf940c7d56",
        "sequence": 18,
        "itemNo": "JYXMCC476",
        "name": "平面度",
        "requirement": "凹≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "caaa45da-2263-4e9c-9868-0446a114e355",
        "sequence": 19,
        "itemNo": "JYXM0145",
        "name": "Ra 表面粗糙度",
        "requirement": "≤1.6μm",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "d1ed940f-58a4-419c-ab51-ef01d2ebce7b",
        "sequence": 20,
        "itemNo": "JYXM0091",
        "name": "外观",
        "requirement": "无磕碰伤和料废",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      }
    ]
  },
  {
    "source": "TF13",
    "masterGuid": "ac478499-3f36-4312-9c3e-30032d24611c",
    "taskGuid": "3e76f323-692a-4ccf-b87d-d4d008857787",
    "taskNo": "GP21090406-1",
    "parent": "GP21090406",
    "product": "2MHM0100651",
    "productName": "HZF707BR-3B-01",
    "process": "M-045",
    "recordTime": "2021-12-27 17:33:22",
    "checkType": "worker_check",
    "result": "OK",
    "items": [
      {
        "detailGuid": "efd2fcfa-52b6-40d8-bc4e-6404ed07f634",
        "sequence": 1,
        "itemNo": "JYXM0001",
        "name": "法兰盘材料",
        "requirement": "",
        "min": 1,
        "max": null,
        "values": [
          "0.2",
          "0.2",
          "0.2",
          "0.2",
          "0.2",
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "123dff51-a3c9-4ea1-bb64-22c39571f552",
        "sequence": 2,
        "itemNo": "JYXM0003",
        "name": "内圈材料",
        "requirement": "",
        "min": 1,
        "max": null,
        "values": [
          "0.2",
          "0.2",
          "0.2",
          "0.2",
          "0.2",
          null,
          null,
          null,
          null,
          null
        ]
      }
    ]
  },
  {
    "source": "TF13",
    "masterGuid": "64d7cbfa-4909-4966-b698-d37ca7f7db15",
    "taskGuid": "518bf39f-aafd-4bdf-a343-e70643ef3aaa",
    "taskNo": "GP22010194-6",
    "parent": "GP22010194",
    "product": "2CHC0100358",
    "productName": "车件HZF707BR-3B-C01",
    "process": "C-007",
    "recordTime": "2022-03-11 10:02:10",
    "checkType": "worker_check",
    "result": "OK",
    "items": [
      {
        "detailGuid": "a274254b-4aba-4853-82e6-a211bae62b5f",
        "sequence": 1,
        "itemNo": "JYXM0096",
        "name": "外径D1",
        "requirement": "φ87.4(-0.05～0)",
        "min": 87.35,
        "max": 87.4,
        "values": [
          "87.37",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "3f80865b-9468-46e4-b408-1f625b70cdab",
        "sequence": 2,
        "itemNo": "JYXM0235",
        "name": "外径D2",
        "requirement": "φ93(-0.04～-0.01)",
        "min": 92.96,
        "max": 92.99,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "95ff34c9-038d-4b27-bdf6-0e2090387b77",
        "sequence": 3,
        "itemNo": "JYXM0098",
        "name": "内径d1",
        "requirement": "φ81.7(-0.04～0.01)",
        "min": 81.66,
        "max": 81.71,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "8e9182af-e769-41dd-90d2-4fca58c2d8d8",
        "sequence": 4,
        "itemNo": "JYXM0238",
        "name": "内径d2",
        "requirement": "φ78.3(-0.04～0.01)",
        "min": 78.26,
        "max": 78.31,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "8cd60a85-48ed-4a14-8c8d-7debd6091af1",
        "sequence": 5,
        "itemNo": "JYXMCC488",
        "name": "沟径De",
        "requirement": "φ78.86(-0.05～0)",
        "min": 78.81,
        "max": 78.86,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "aa3ee274-3cda-45ef-a90f-01445a58fc84",
        "sequence": 6,
        "itemNo": "JYXMCC489",
        "name": "沟位ae1",
        "requirement": "11.94(-0.06~-0.02)",
        "min": 11.88,
        "max": 11.92,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "ccde13c6-7fa0-4c72-8843-e8d742b90f92",
        "sequence": 7,
        "itemNo": "JYXMCC490",
        "name": "沟位ae2",
        "requirement": "33.3(0.02~0.06)",
        "min": 33.32,
        "max": 33.36,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "fc2315e9-764e-466a-b345-9ee59afef6b9",
        "sequence": 8,
        "itemNo": "JYXM0330",
        "name": "沟曲率R",
        "requirement": "6.03(0~0.04)",
        "min": 6.03,
        "max": 6.07,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "376dd06d-3c8d-49c0-8e3c-5f66ccc34da5",
        "sequence": 9,
        "itemNo": "JYXM472",
        "name": "总高H1",
        "requirement": "45.3(0~0.03)",
        "min": 45.3,
        "max": 45.6,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "cf4b25f8-5a1a-4c8a-b972-5accda6ba579",
        "sequence": 10,
        "itemNo": "JYXM0085",
        "name": "台阶高度H2",
        "requirement": "17.4(-0.03~0)",
        "min": 17.37,
        "max": 17.4,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "be26ac7d-d9ca-48fd-8758-16a6f954a656",
        "sequence": 11,
        "itemNo": "JYXM454",
        "name": "法兰厚度L",
        "requirement": "15.4±0.20",
        "min": 15.2,
        "max": 15.6,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "380e5fd2-2256-428e-9e81-c5b95b11ae5d",
        "sequence": 12,
        "itemNo": "JYXM0352",
        "name": "外径椭圆VDp",
        "requirement": "≤0.015",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "dda5db34-3ade-4c62-a78a-382670449418",
        "sequence": 13,
        "itemNo": "JYXM0341",
        "name": "内径椭圆Vdp",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "db06b46c-bc8f-45e4-9fc8-9e6b09a88f89",
        "sequence": 14,
        "itemNo": "JYXM0329",
        "name": "沟径椭圆Vdip",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "f34ef600-2317-45b8-ade8-60a68693bdef",
        "sequence": 15,
        "itemNo": "JYXM0325",
        "name": "沟摆Si",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "80abbab9-09aa-4972-8a79-c9be6e991fe6",
        "sequence": 16,
        "itemNo": "JYXMCC427",
        "name": "平行差c",
        "requirement": "≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "18bd1874-6406-49ee-ae4b-363ddd15a33c",
        "sequence": 17,
        "itemNo": "JYXM0090",
        "name": "同心度",
        "requirement": "≤0.05",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "cf2ebebd-3840-410f-bfbd-5873350b8a1e",
        "sequence": 18,
        "itemNo": "JYXMCC476",
        "name": "平面度",
        "requirement": "凹≤0.02",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "2cd6d66b-6b6d-4e44-93bb-b1623b14007a",
        "sequence": 19,
        "itemNo": "JYXM0145",
        "name": "Ra 表面粗糙度",
        "requirement": "≤1.6μm",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      {
        "detailGuid": "19324326-26ae-4400-8234-aac9ce33d473",
        "sequence": 20,
        "itemNo": "JYXM0091",
        "name": "外观",
        "requirement": "无磕碰伤和料废",
        "min": 0,
        "max": 0,
        "values": [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      }
    ]
  }
]

export const INSPECTION_TASKS: InspectionTaskSample[] = [...new Map(
  INSPECTION_RECORDS.map((record) => [record.taskNo, record]),
).values()].map((record) => ({
  parent: record.parent,
  rjhguid: record.taskNo,
  product: record.product,
  name: record.productName,
  process: record.process,
  workshop: '历史 TF13 样例',
  line: '历史检验数据',
  plan: 0,
  done: 0,
  scrap: 0,
  unit: '只',
  status: '关闭',
  date: record.recordTime,
  inspectionSample: true,
}))

export function getInspectionRecords(taskNo: string | null | undefined) {
  if (!taskNo) return []
  return INSPECTION_RECORDS.filter((record) => record.taskNo === taskNo)
}

function normalizedName(value: string) {
  return value.toLocaleLowerCase().replace(/[\s，,。！？、_-]/g, '')
}

export function parseMeasurementCommand(text: string, items: InspectionItem[]): MeasurementParseResult {
  const clean = text.trim()
  const columnMatch = clean.match(/第?\s*(\d{1,2})\s*(?:列|次)/)
  if (columnMatch && (Number(columnMatch[1]) < 1 || Number(columnMatch[1]) > 10)) {
    return { status: 'invalid', reason: '目标列只支持 1～10' }
  }

  const normalized = normalizedName(clean)
  const matches = items.filter((item) => normalized.includes(normalizedName(item.name)))
  if (!matches.length) {
    const numberCount = clean.match(/-?\d+(?:\.\d+)?/g)?.length ?? 0
    return numberCount >= 2
      ? { status: 'invalid', reason: '当前检验记录中没有该项目' }
      : { status: 'incomplete', reason: '请说明检验项目、目标列和测量值' }
  }
  if (matches.length > 1) return { status: 'invalid', reason: '检验项目不唯一，请说项目序号或完整名称' }
  if (!columnMatch) return { status: 'incomplete', reason: '请说明第 1～10 列中的目标列' }

  const values = clean.match(/-?\d+(?:\.\d+)?/g) ?? []
  if (!values.length) return { status: 'incomplete', reason: '请说明测量值' }

  const item = matches[0]
  return {
    status: 'ready',
    detailGuid: item.detailGuid,
    itemName: item.name,
    column: Number(columnMatch[1]),
    value: values.at(-1)!,
  }
}

