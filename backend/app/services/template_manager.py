"""95 VASP calculation templates manager."""
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Template definition data - 15 categories, 95 calculation types
TEMPLATE_CATEGORIES: list[dict] = [
    {
        "key": "basic", "name": "基础计算", "icon": "🔬",
        "items": [
            {"key": "static_scf", "label": "静态自洽 SCF", "desc": "单次自洽求解", "icon": "⚛️",
             "incar": {"NSW": 0, "IBRION": -1, "ENCUT": 400, "EDIFF": 1e-4, "ISMEAR": 1, "SIGMA": 0.05},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "structure_opt", "label": "结构优化", "desc": "离子/晶格弛豫", "icon": "🔧",
             "incar": {"NSW": 100, "IBRION": 2, "ISIF": 3, "ENCUT": 400, "EDIFF": 1e-4, "EDIFFG": -0.01},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "nscf", "label": "非自洽 NSCF", "desc": "读取CHGCAR", "icon": "📖",
             "incar": {"ICHARG": 11, "NSW": 0, "IBRION": -1, "ENCUT": 400, "LORBIT": 11},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "restart", "label": "断点续算", "desc": "从WAVECAR续算", "icon": "🔄",
             "incar": {"ISTART": 1, "ICHARG": 1, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
        ]
    },
    {
        "key": "electronic", "name": "电子结构分析", "icon": "⚡",
        "items": [
            {"key": "dos", "label": "态密度 DOS", "desc": "TDOS/PDOS", "icon": "📊",
             "incar": {"ICHARG": 11, "NSW": 0, "LORBIT": 10, "NEDOS": 2001, "ISMEAR": -5},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "band_structure", "label": "能带结构", "desc": "沿k点路径色散", "icon": "〰️",
             "incar": {"ICHARG": 11, "NSW": 0, "LORBIT": 10, "ISMEAR": 0, "SIGMA": 0.05},
             "kpoints": {"style": "M", "grid": [1, 1, 1]}},
            {"key": "partial_charge", "label": "部分电荷密度", "desc": "特定能带/窗口", "icon": "🗺️",
             "incar": {"LPARD": True, "ICHARG": 11, "NSW": 0, "IBAND": "1 2"},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "elf", "label": "电子局域函数 ELF", "desc": "化学键/孤对电子", "icon": "🔗",
             "incar": {"LELF": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "work_function", "label": "功函数", "desc": "静电势+功函数", "icon": "📏",
             "incar": {"LVTOT": True, "LVHAR": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "stm", "label": "STM 模拟", "desc": "扫描隧道显微镜", "icon": "🔬",
             "incar": {"LPARD": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "bader", "label": "Bader 电荷", "desc": "原子电荷布居", "icon": "⚖️",
             "incar": {"LAECHG": True, "LCHARG": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "charge_diff", "label": "电荷密度差", "desc": "差分电荷密度", "icon": "🎨",
             "incar": {"LCHARG": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "spin_density", "label": "自旋密度", "desc": "自旋极化电荷差", "icon": "🧲",
             "incar": {"ISPIN": 2, "LCHARG": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
        ]
    },
    {
        "key": "dynamics", "name": "动力学计算", "icon": "🏃",
        "items": [
            {"key": "md_nvt", "label": "分子动力学 NVT", "desc": "恒温MD", "icon": "🌡️",
             "incar": {"IBRION": 0, "NSW": 1000, "POTIM": 1.0, "SMASS": 1, "TEBEG": 300, "TEEND": 300, "MDALGO": 2, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [2, 2, 2]}},
            {"key": "md_nve", "label": "分子动力学 NVE", "desc": "微正则系综", "icon": "🔒",
             "incar": {"IBRION": 0, "NSW": 1000, "POTIM": 1.0, "SMASS": -3, "MDALGO": 1, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [2, 2, 2]}},
            {"key": "neb", "label": "NEB 过渡态搜索", "desc": "最小能量路径", "icon": "⛰️",
             "incar": {"IMAGES": 5, "SPRING": -5.0, "IBRION": 2, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "dimer", "label": "Dimer 方法", "desc": "单端点过渡态", "icon": "🎯",
             "incar": {"IBRION": 44, "ICHAIN": 2, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "frequencies", "label": "频率计算", "desc": "振动频率", "icon": "🎵",
             "incar": {"IBRION": 5, "NSW": 1, "POTIM": 0.015, "NFREE": 2, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "phonon_dos", "label": "声子态密度", "desc": "声子谱与热力学", "icon": "🔊",
             "incar": {"IBRION": 8, "NSW": 1, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "slow_growth", "label": "缓加分子动力学", "desc": "自由能积分", "icon": "🐢",
             "incar": {"IBRION": 0, "SMASS": -1, "NSW": 1000, "POTIM": 0.5, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [2, 2, 2]}},
            {"key": "blue_moon", "label": "蓝月系综", "desc": "约束MD自由能", "icon": "🌙",
             "incar": {"IBRION": 0, "MDALGO": 2, "SMASS": 1, "TEBEG": 300, "NSW": 1000},
             "kpoints": {"style": "M", "grid": [2, 2, 2]}},
            {"key": "monte_carlo", "label": "蒙特卡洛", "desc": "随机采样", "icon": "🎲",
             "incar": {"IBRION": 0, "MDALGO": 3, "NSW": 1000, "TEBEG": 300},
             "kpoints": {"style": "M", "grid": [2, 2, 2]}},
        ]
    },
    {
        "key": "optical", "name": "光学性质", "icon": "🌈",
        "items": [
            {"key": "dielectric", "label": "介电函数", "desc": "ε(ω)频率相关", "icon": "🔮",
             "incar": {"LOPTICS": True, "CSHIFT": 0.1, "NEDOS": 2001, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "absorption", "label": "吸收光谱", "desc": "光吸收系数", "icon": "🌞",
             "incar": {"LOPTICS": True, "CSHIFT": 0.1, "NEDOS": 2001, "NSW": 0},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "refractive", "label": "折射率", "desc": "复折射率", "icon": "💎",
             "incar": {"LOPTICS": True, "CSHIFT": 0.1, "NEDOS": 2001, "NSW": 0},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "reflectivity", "label": "反射率", "desc": "Fresnel公式", "icon": "🪞",
             "incar": {"LOPTICS": True, "CSHIFT": 0.1, "NEDOS": 2001},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "moke", "label": "磁光克尔 MOKE", "desc": "磁性磁光响应", "icon": "🧲",
             "incar": {"LOPTICS": True, "LSORBIT": True, "LNONCOLLINEAR": True, "CSHIFT": 0.1, "NEDOS": 2001},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "shg", "label": "二次谐波 SHG", "desc": "非线性光学", "icon": "✨",
             "incar": {"LOPTICS": True, "NSW": 0},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "bse", "label": "BSE 激子", "desc": "Bethe-Salpeter", "icon": "🧬",
             "incar": {"ALGO": "BSE", "LOPTICS": True, "NEDOS": 2001},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
        ]
    },
    {
        "key": "spectroscopy", "name": "光谱计算", "icon": "🔦",
        "items": [
            {"key": "raman", "label": "拉曼光谱", "desc": "拉曼活性模", "icon": "💡",
             "incar": {"LEPSILON": True, "IBRION": 7, "NSW": 1, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "ir", "label": "红外光谱", "desc": "红外活性模", "icon": "🔥",
             "incar": {"LEPSILON": True, "IBRION": 7, "NSW": 1, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "xas", "label": "X射线吸收谱 XAS", "desc": "芯电子激发", "icon": "🩻",
             "incar": {"ICORELEVEL": 1, "CLNT": 1, "CLN": 1, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "xes", "label": "X射线发射谱 XES", "desc": "芯-价带荧光", "icon": "💚",
             "incar": {"ICORELEVEL": 2, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "eels", "label": "电子能量损失谱", "desc": "等离子激元", "icon": "⚛️",
             "incar": {"LOPTICS": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "nmr", "label": "核磁共振 NMR", "desc": "化学位移", "icon": "🧪",
             "incar": {"LCHIMAG": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "epr", "label": "电子顺磁共振", "desc": "g张量/超精细", "icon": "🔍",
             "incar": {"LNONCOLLINEAR": True, "LSORBIT": True, "NSW": 0},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "mossbauer", "label": "穆斯堡尔谱", "desc": "核电四极矩", "icon": "☢️",
             "incar": {"LEFG": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "xps", "label": "X射线光电子谱", "desc": "芯能级结合能", "icon": "📡",
             "incar": {"ICORELEVEL": 1, "CLNT": 1, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
        ]
    },
    {
        "key": "mechanical", "name": "力学性质", "icon": "💪",
        "items": [
            {"key": "elastic", "label": "弹性常数", "desc": "Cij矩阵", "icon": "📐",
             "incar": {"IBRION": 6, "ISIF": 3, "NFREE": 2, "NSW": 1, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "piezoelectric", "label": "压电张量", "desc": "eij张量", "icon": "⚡",
             "incar": {"LEPSILON": True, "LCALCEPS": True, "IBRION": 7, "NSW": 1, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "bulk_modulus", "label": "体弹模量", "desc": "BM-EOS", "icon": "📏",
             "incar": {"ISIF": 4, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "shear_youngs", "label": "剪切/杨氏模量", "desc": "VRH平均", "icon": "📊",
             "incar": {"IBRION": 6, "ISIF": 3, "NFREE": 2, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "poisson", "label": "泊松比", "desc": "弹性常数导出", "icon": "🔄",
             "incar": {"IBRION": 6, "ISIF": 3, "NFREE": 2, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "eos", "label": "状态方程 EOS", "desc": "BM拟合", "icon": "📈",
             "incar": {"ISIF": 4, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "stress_strain", "label": "应力-应变", "desc": "理想强度", "icon": "💥",
             "incar": {"IBRION": 6, "ISIF": 3, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
        ]
    },
    {
        "key": "magnetic", "name": "磁学性质", "icon": "🧲",
        "items": [
            {"key": "spin_polarized", "label": "自旋极化", "desc": "铁磁/反铁磁", "icon": "↑↓",
             "incar": {"ISPIN": 2, "MAGMOM": "2.0*1", "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "non_collinear", "label": "非共线磁性", "desc": "任意磁矩排布", "icon": "🌀",
             "incar": {"LNONCOLLINEAR": True, "MAGMOM": "1 0 0  0 1 0", "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "soc", "label": "自旋轨道耦合 SOC", "desc": "磁晶各向异性", "icon": "🔀",
             "incar": {"LSORBIT": True, "LNONCOLLINEAR": True, "SAXIS": [0, 0, 1], "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "mae", "label": "磁各向异性 MAE", "desc": "易磁化轴", "icon": "🧭",
             "incar": {"LSORBIT": True, "LNONCOLLINEAR": True, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "heisenberg", "label": "海森堡交换 Jij", "desc": "交换耦合", "icon": "🔗",
             "incar": {"LORBIT": 11, "ENCUT": 400, "ISPIN": 2},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "dmi", "label": "DMI 相互作用", "desc": "手性磁作用", "icon": "🔄",
             "incar": {"LNONCOLLINEAR": True, "LSORBIT": True, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "magnon", "label": "自旋波/磁振子", "desc": "自旋激发谱", "icon": "〰️",
             "incar": {"LSPECTRAL": True, "LSPIRAL": True, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
        ]
    },
    {
        "key": "advanced", "name": "高级电子方法", "icon": "🧠",
        "items": [
            {"key": "hybrid_hse", "label": "杂化泛函 HSE", "desc": "HSE06精确交换", "icon": "💎",
             "incar": {"LHFCALC": True, "HFSCREEN": 0.2, "AEXX": 0.25, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "gw", "label": "GW 准粒子", "desc": "GW带隙修正", "icon": "⚛️",
             "incar": {"ALGO": "GW0", "NOMEGA": 50, "ENCUT": 400, "NBANDSGW": 100},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "gw0_hse", "label": "G0W0@HSE", "desc": "杂化+GW", "icon": "🔮",
             "incar": {"ALGO": "GW0", "LHFCALC": True, "HFSCREEN": 0.2, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "rpa", "label": "RPA 关联能", "desc": "随机相位近似", "icon": "📐",
             "incar": {"ALGO": "RPA", "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "dft_plus_u", "label": "DFT+U", "desc": "强关联修正", "icon": "🔧",
             "incar": {"LDAU": True, "LDAUTYPE": 2, "LDAUU": [3.0], "LDAUJ": [0.0], "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "vdw", "label": "范德华修正", "desc": "DFT-D3/TS", "icon": "💨",
             "incar": {"IVDW": 12, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "meta_gga", "label": "Meta-GGA SCAN", "desc": "动能密度依赖", "icon": "📊",
             "incar": {"METAGGA": "SCAN", "LASPH": True, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "berry_phase", "label": "贝里相位", "desc": "铁电极化", "icon": "⚡",
             "incar": {"LCALCPOL": True, "LBERRY": True, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "born_charge", "label": "玻恩有效电荷", "desc": "极性声子模式", "icon": "🔌",
             "incar": {"LEPSILON": True, "LCALCEPS": True, "IBRION": 7, "NSW": 1, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "cdft", "label": "约束 DFT CDFT", "desc": "电荷/自旋约束", "icon": "🔒",
             "incar": {"LCONSTR": True, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
        ]
    },
    {
        "key": "transport", "name": "输运性质", "icon": "🚀",
        "items": [
            {"key": "conductivity", "label": "电导率", "desc": "Boltzmann输运", "icon": "⚡",
             "incar": {"LTRANSPORT": True, "LOPTICS": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "thermoelectric", "label": "热电性质", "desc": "Seebeck/ZT", "icon": "🌡️",
             "incar": {"LTRANSPORT": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "epc", "label": "电子-声子耦合", "desc": "超导Tc", "icon": "🔗",
             "incar": {"LEPC": True, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "tmr", "label": "隧道结 TMR", "desc": "磁隧道结", "icon": "🔌",
             "incar": {"LTRANSPORT": True, "ISPIN": 2, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
        ]
    },
    {
        "key": "surfaces", "name": "表界面与低维", "icon": "📐",
        "items": [
            {"key": "surface_energy", "label": "表面能", "desc": "Wulff构型", "icon": "🏔️",
             "incar": {"ISIF": 2, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 1]}},
            {"key": "adsorption", "label": "吸附能", "desc": "分子/原子吸附", "icon": "🧲",
             "incar": {"ISIF": 2, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 1]}},
            {"key": "work_function_surf", "label": "表面功函数", "desc": "偶极矩分析", "icon": "📏",
             "incar": {"LVTOT": True, "LVHAR": True, "NSW": 0, "ENCUT": 400, "IDIPOL": 3, "LDIPOL": True},
             "kpoints": {"style": "M", "grid": [8, 8, 1]}},
            {"key": "2d_materials", "label": "二维材料", "desc": "真空层+偶极修正", "icon": "🪶",
             "incar": {"LDIPOL": True, "IDIPOL": 3, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 1]}},
            {"key": "heterostructure", "label": "异质结", "desc": "界面电荷转移", "icon": "🧩",
             "incar": {"LDIPOL": True, "IDIPOL": 3, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 1]}},
            {"key": "nanowire", "label": "纳米线/管", "desc": "低维限域", "icon": "🧵",
             "incar": {"NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [1, 1, 8]}},
        ]
    },
    {
        "key": "defects", "name": "缺陷与掺杂", "icon": "🔍",
        "items": [
            {"key": "defect_formation", "label": "缺陷形成能", "desc": "热力学稳定性", "icon": "⚡",
             "incar": {"ISIF": 2, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "charged_defect", "label": "带电缺陷修正", "desc": "Freysoldt修正", "icon": "🔌",
             "incar": {"NELECT": 1, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "doping", "label": "掺杂", "desc": "替位/间隙掺杂", "icon": "🧪",
             "incar": {"NELECT": 1, "MAGMOM": "1.0*1", "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "polaron", "label": "极化子", "desc": "电子/空穴自陷", "icon": "🌀",
             "incar": {"ISIF": 2, "LDAU": True, "LDAUU": [4.0], "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
        ]
    },
    {
        "key": "catalysis", "name": "反应与催化", "icon": "⚗️",
        "items": [
            {"key": "ci_neb", "label": "CI-NEB 反应路径", "desc": "最小能量路径", "icon": "⛰️",
             "incar": {"IMAGES": 5, "IBRION": 1, "LCLIMB": True, "SPRING": -5.0, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "dimer_ts", "label": "Dimer 过渡态", "desc": "无像点TS搜索", "icon": "🎯",
             "incar": {"IBRION": 44, "ICHAIN": 2, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "ts_verify", "label": "过渡态验证", "desc": "唯一虚频", "icon": "✅",
             "incar": {"IBRION": 5, "NFREE": 2, "NSW": 1, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "zpe", "label": "零点能修正 ZPE", "desc": "自由能修正", "icon": "📐",
             "incar": {"IBRION": 5, "NFREE": 2, "NSW": 1, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "fep", "label": "自由能微扰", "desc": "溶液相反应", "icon": "🧪",
             "incar": {"IBRION": 0, "MDALGO": 2, "SMASS": 1, "TEBEG": 300, "NSW": 5000},
             "kpoints": {"style": "M", "grid": [2, 2, 2]}},
            {"key": "che", "label": "计算氢电极", "desc": "CHE模型", "icon": "🔋",
             "incar": {"NELECT": 0, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
        ]
    },
    {
        "key": "solvation", "name": "溶剂与电化学", "icon": "💧",
        "items": [
            {"key": "vaspsol", "label": "隐式溶剂 VASPsol", "desc": "溶剂化自由能", "icon": "🧴",
             "incar": {"LSOL": True, "EB": 80.0, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "eci", "label": "电化学界面", "desc": "恒电势DFT", "icon": "🔌",
             "incar": {"LSOL": True, "NELECT": 0, "NSW": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "ion_transport", "label": "离子输运", "desc": "Li+扩散", "icon": "🚗",
             "incar": {"IBRION": 0, "MDALGO": 2, "SMASS": 1, "TEBEG": 400, "NSW": 5000},
             "kpoints": {"style": "M", "grid": [2, 2, 2]}},
        ]
    },
    {
        "key": "high_pressure", "name": "高压与极端条件", "icon": "💎",
        "items": [
            {"key": "hp_eos", "label": "高压状态方程", "desc": "高压相变", "icon": "📈",
             "incar": {"ISIF": 4, "NSW": 100, "PSTRESS": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "enthalpy", "label": "焓差相稳定性", "desc": "高压相排序", "icon": "⚖️",
             "incar": {"ISIF": 4, "NSW": 100, "PSTRESS": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "hp_elastic", "label": "高压弹性/声速", "desc": "地幔矿物波速", "icon": "〰️",
             "incar": {"IBRION": 6, "ISIF": 3, "PSTRESS": 100, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
        ]
    },
    {
        "key": "special", "name": "特殊功能", "icon": "⭐",
        "items": [
            {"key": "wf_visualization", "label": "波函数可视化", "desc": "3D轨道等值面", "icon": "👁️",
             "incar": {"LREAL": ".TRUE.", "LWAVE": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "effective_mass", "label": "有效质量", "desc": "载流子有效质量", "icon": "⚖️",
             "incar": {"LORBIT": 10, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [8, 8, 8]}},
            {"key": "band_alignment", "label": "带边对齐", "desc": "异质结带阶", "icon": "📏",
             "incar": {"LVTOT": True, "LVHAR": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "wannier90", "label": "Wannier函数", "desc": "紧束缚哈密顿", "icon": "🔗",
             "incar": {"LWANNIER90": True, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "efield", "label": "外电场", "desc": "外加电场响应", "icon": "⚡",
             "incar": {"EFIELD": 0.1, "LDIPOL": True, "IDIPOL": 3, "NSW": 0, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "constrained_mag", "label": "约束磁矩", "desc": "固定局域磁矩", "icon": "🔒",
             "incar": {"I_CONSTRAINED_M": 1, "LAMBDA": 10.0, "ISPIN": 2, "ENCUT": 400},
             "kpoints": {"style": "M", "grid": [4, 4, 4]}},
            {"key": "single_point", "label": "单点能", "desc": "快速总能评估", "icon": "⚡",
             "incar": {"NSW": 0, "IBRION": -1, "ENCUT": 300, "EDIFF": 1e-3, "ISMEAR": 0, "SIGMA": 0.1},
             "kpoints": {"style": "M", "grid": [2, 2, 2]}},
        ]
    },
]


class TemplateManager:
    """Manage VASP calculation templates."""

    @staticmethod
    def get_categories() -> list[dict]:
        return [{"key": c["key"], "name": c["name"], "icon": c["icon"], "count": len(c["items"])}
                for c in TEMPLATE_CATEGORIES]

    @staticmethod
    def get_all_templates() -> list[dict]:
        templates = []
        for cat in TEMPLATE_CATEGORIES:
            for item in cat["items"]:
                templates.append({
                    "key": item["key"], "label": item["label"], "desc": item["desc"],
                    "icon": item["icon"], "category": cat["key"], "category_name": cat["name"],
                })
        return templates

    @staticmethod
    def get_template(key: str) -> dict | None:
        for cat in TEMPLATE_CATEGORIES:
            for item in cat["items"]:
                if item["key"] == key:
                    return {
                        "key": item["key"], "label": item["label"], "desc": item["desc"],
                        "icon": item["icon"], "category": cat["key"], "category_name": cat["name"],
                        "incar": item["incar"], "kpoints": item.get("kpoints", {}),
                    }
        return None

    @staticmethod
    def get_templates_by_category(category_key: str) -> list[dict]:
        for cat in TEMPLATE_CATEGORIES:
            if cat["key"] == category_key:
                return [{"key": i["key"], "label": i["label"], "desc": i["desc"], "icon": i["icon"]}
                        for i in cat["items"]]
        return []

    @staticmethod
    def search_templates(query: str) -> list[dict]:
        q = query.lower()
        results = []
        for cat in TEMPLATE_CATEGORIES:
            for item in cat["items"]:
                if q in item["label"].lower() or q in item["desc"].lower() or q in item["key"].lower():
                    results.append({
                        "key": item["key"], "label": item["label"], "desc": item["desc"],
                        "icon": item["icon"], "category": cat["key"], "category_name": cat["name"],
                    })
        return results
