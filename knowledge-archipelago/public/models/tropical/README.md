# Tropical models · 来源与转换说明

`public/models/tropical/*.glb` 由项目自带脚本
[`scripts/import-tropical-assets.py`](../../../scripts/import-tropical-assets.py)
从 **Tropical Rain Forest Environment Pack v2.0** 离线转换而来。

- 原作者 / 发行：**Ronald C. Kapaun · 3TD Studios, LLC**
- 源包格式：Torque 3D 的 COLLADA（`.DAE`）+ DDS 贴图
- 使用资产：海滩棕榈、王棕、女王棕、香蕉、号角树、蕨类、象耳芋、海滩草、海蚀岩、苔石、木栈桥、丛林木屋、木箱
- 转换内容：选取最高 LOD、按材质合批、节点变换烘焙、Z-up→Y-up、英制/厘米统一为米、贴图缩放并内嵌进 GLB
- 转换脚本会从 `Tropical_Environment_Pack_v2.0_Ready` 读取原始文件；源包不随本项目分发

## 使用与授权

这些 GLB 是 **为当前项目转换的运行资产**。原始环境包的使用、修改与再分发受你获取该包时的授权条款约束；本项目不额外授予原始包或独立资产的分发权。若要单独复用这些模型，请先确认你拥有相应授权。

## 重新生成

```bash
python scripts/import-tropical-assets.py "H:\minimax\1\Tropical_Environment_Pack_v2.0\Tropical_Environment_Pack_v2.0_Ready"
```

脚本依赖：`trimesh`、`pycollada`、`Pillow`、`lxml`。

`manifest.json` 记录了每个 GLB 的三角形数、材质、目标高度和最终包围盒，便于排查缩放与碰撞范围。
