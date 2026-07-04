"""INCAR tag metadata registry (100+ tags)."""
from dataclasses import dataclass, field
from typing import Any

@dataclass
class TagMeta:
    tag: str
    type: str  # enum, int, float, bool, str, list
    default: Any = None
    options: list | None = None
    option_descriptions: dict | None = None
    min_val: float | None = None
    max_val: float | None = None
    unit: str = ""
    category: str = "基础"
    description: str = ""
    advanced: bool = False
    dependencies: dict[str, Any] = field(default_factory=dict)

INCAR_TAG_REGISTRY: dict[str, TagMeta] = {
    # ===== SCF & Electronic Minimization =====
    "ENCUT": TagMeta(tag="ENCUT", type="float", default=400.0, min_val=50.0, max_val=2000.0,
                     unit="eV", category="基础", description="平面波截断能"),
    "EDIFF": TagMeta(tag="EDIFF", type="float", default=1e-5, min_val=1e-10, max_val=1.0,
                     category="基础", description="电子步收敛标准 (eV)"),
    "NELM": TagMeta(tag="NELM", type="int", default=60, min_val=1, max_val=500,
                    category="基础", description="最大电子步数"),
    "NELMIN": TagMeta(tag="NELMIN", type="int", default=2, min_val=1, max_val=20,
                      advanced=True, category="基础", description="最小电子步数"),
    "NELMDL": TagMeta(tag="NELMDL", type="int", default=-5, advanced=True,
                      category="基础", description="初始非自洽电子步数"),
    "PREC": TagMeta(tag="PREC", type="enum", default="Normal",
                    options=["Low", "Medium", "Normal", "High", "Accurate", "Single"],
                    category="基础", description="计算精度"),
    "ALGO": TagMeta(tag="ALGO", type="enum", default="Normal",
                    options=["Normal", "VeryFast", "Fast", "Conjugate", "All", "Damped",
                             "Subrot", "Eigenval", "Exact", "Diag", "GW0", "GW", "BSE",
                             "Chi", "RPA", "RPAFORCE", "SCS", "ACFDT"],
                    category="基础", description="电子算法"),
    "ADDGRID": TagMeta(tag="ADDGRID", type="bool", default=False, advanced=True,
                       category="基础", description="附加支持网格"),
    "LREAL": TagMeta(tag="LREAL", type="enum", default="Auto",
                     options=["Auto", ".TRUE.", ".FALSE.", "On", "Off"],
                     option_descriptions={"Auto":"自动", ".TRUE.":"实空间投影", ".FALSE.":"倒空间"},
                     category="基础", description="实空间投影"),

    # ===== Ionic Relaxation =====
    "NSW": TagMeta(tag="NSW", type="int", default=0, min_val=0, max_val=10000,
                   category="离子", description="离子步数 (0=静态)"),
    "IBRION": TagMeta(tag="IBRION", type="enum", default=-1,
                      options=[-1, 0, 1, 2, 3, 5, 6, 7, 8, 44],
                      option_descriptions={-1:"静态(不移动)", 0:"分子动力学", 1:"准牛顿(RMM-DIIS)",
                                           2:"共轭梯度(CG)", 3:"阻尼分子动力学",
                                           5:"振动频率(差分)", 6:"弹性常数",
                                           7:"介电/压电/玻恩电荷", 8:"声子",
                                           44:"二聚体方法(Dimer)"},
                      category="离子", description="离子弛豫算法"),
    "ISIF": TagMeta(tag="ISIF", type="enum", default=2,
                    options=[0, 1, 2, 3, 4, 5, 6, 7],
                    option_descriptions={0:"仅能量", 1:"仅力", 2:"离子弛豫",
                                         3:"离子+晶格弛豫", 4:"仅晶格弛豫",
                                         5:"仅应力", 6:"应力+晶格",
                                         7:"离子+晶格+体积"},
                    category="离子", description="弛豫自由度"),
    "POTIM": TagMeta(tag="POTIM", type="float", default=0.5, min_val=0.0, max_val=100.0,
                     category="离子", description="离子步长/时间步长"),
    "EDIFFG": TagMeta(tag="EDIFFG", type="float", default=1e-2,
                      category="离子", description="离子弛豫收敛标准 (eV/A)"),
    "SMASS": TagMeta(tag="SMASS", type="float", default=-3.0,
                     category="离子", description="MD 质量阻尼参数"),

    # ===== Brillouin Zone =====
    "ISMEAR": TagMeta(tag="ISMEAR", type="enum", default=1,
                      options=[-5, -4, -3, -2, -1, 0, 1, 2],
                      option_descriptions={-5:"四面体(Blochl)", -4:"四面体(无修正)",
                                           -3:"四面体(LDA/GGA)", -2:"四面体",
                                           -1:"Fermi", 0:"Gaussian", 1:"Methfessel-Paxton 1st",
                                           2:"Methfessel-Paxton 2nd"},
                      category="基础", description="展宽方法"),
    "SIGMA": TagMeta(tag="SIGMA", type="float", default=0.05, min_val=0.0, max_val=5.0,
                     unit="eV", category="基础", description="展宽宽度"),

    # ===== Initialization =====
    "ISTART": TagMeta(tag="ISTART", type="enum", default=1, options=[0, 1, 2, 3],
                      category="自洽", description="波函数初始化方式"),
    "ICHARG": TagMeta(tag="ICHARG", type="enum", default=2, options=[0, 1, 2, 4, 11, 12],
                      category="自洽", description="电荷密度初始化方式"),

    # ===== Output =====
    "LWAVE": TagMeta(tag="LWAVE", type="bool", default=True, category="输出", description="写入WAVECAR"),
    "LCHARG": TagMeta(tag="LCHARG", type="bool", default=True, category="输出", description="写入CHGCAR"),
    "LORBIT": TagMeta(tag="LORBIT", type="enum", default=None, options=[None, 0, 1, 2, 10, 11, 12],
                      category="输出", description="轨道投影输出"),
    "LVTOT": TagMeta(tag="LVTOT", type="bool", default=False, advanced=True,
                     category="输出", description="写入总局域势LOCPOT"),
    "LVHAR": TagMeta(tag="LVHAR", type="bool", default=False, advanced=True,
                     category="输出", description="写入Hartree势"),
    "LELF": TagMeta(tag="LELF", type="bool", default=False, advanced=True,
                    category="输出", description="写入电子局域函数ELFCAR"),
    "LAECHG": TagMeta(tag="LAECHG", type="bool", default=False, advanced=True,
                      category="输出", description="写入AECCAR (Bader)"),
    "LOPTICS": TagMeta(tag="LOPTICS", type="bool", default=False,
                       category="输出", description="计算频率相关介电矩阵"),
    "LPARD": TagMeta(tag="LPARD", type="bool", default=False, advanced=True,
                     category="输出", description="分波电荷密度"),
    "NEDOS": TagMeta(tag="NEDOS", type="int", default=301, min_val=100, max_val=10000,
                     advanced=True, category="输出", description="DOS能量点数"),

    # ===== Spin & Magnetism =====
    "ISPIN": TagMeta(tag="ISPIN", type="enum", default=1, options=[1, 2],
                     category="磁学", description="自旋极化"),
    "MAGMOM": TagMeta(tag="MAGMOM", type="str", default=None,
                      category="磁学", description="初始磁矩"),
    "LNONCOLLINEAR": TagMeta(tag="LNONCOLLINEAR", type="bool", default=False,
                             category="磁学", description="非共线磁性"),
    "LSORBIT": TagMeta(tag="LSORBIT", type="bool", default=False,
                       category="磁学", description="自旋轨道耦合(SOC)"),
    "SAXIS": TagMeta(tag="SAXIS", type="list", default=[0, 0, 1],
                     category="磁学", description="自旋量子化轴"),

    # ===== DFT+U =====
    "LDAU": TagMeta(tag="LDAU", type="bool", default=False,
                    category="磁学", description="DFT+U 开关"),
    "LDAUTYPE": TagMeta(tag="LDAUTYPE", type="enum", default=2, options=[1, 2, 4],
                        category="磁学", description="DFT+U 类型", dependencies={"LDAU": True}),
    "LDAUU": TagMeta(tag="LDAUU", type="list", default=[0.0],
                     category="磁学", description="U参数(eV)", dependencies={"LDAU": True}),
    "LDAUJ": TagMeta(tag="LDAUJ", type="list", default=[0.0],
                     category="磁学", description="J参数(eV)", dependencies={"LDAU": True}),

    # ===== Hybrid =====
    "LHFCALC": TagMeta(tag="LHFCALC", type="bool", default=False,
                       category="杂化", description="杂化泛函/Hartree-Fock"),
    "HFSCREEN": TagMeta(tag="HFSCREEN", type="float", default=0.2,
                        category="杂化", description="HSE屏蔽参数"),
    "AEXX": TagMeta(tag="AEXX", type="float", default=0.25, min_val=0.0, max_val=1.0,
                    category="杂化", description="精确交换比例"),
    "PRECFOCK": TagMeta(tag="PRECFOCK", type="enum", default="Normal",
                        options=["Low", "Medium", "Normal", "Fast", "Accurate"],
                        advanced=True, category="杂化", description="Fock交换精度"),

    # ===== GW =====
    "NOMEGA": TagMeta(tag="NOMEGA", type="int", default=50, min_val=10, max_val=500,
                      advanced=True, category="高级", description="GW频率点数"),

    # ===== vdW =====
    "IVDW": TagMeta(tag="IVDW", type="enum", default=None,
                    options=[None, 0, 1, 2, 3, 4, 10, 11, 12, 20, 21, 202, 30],
                    category="高级", description="范德华修正方法"),

    # ===== Meta-GGA =====
    "METAGGA": TagMeta(tag="METAGGA", type="enum", default=None,
                       options=[None, "SCAN", "R2SCAN", "RSCAN", "MS0", "MS1", "MS2",
                                "TPSS", "RTPSS", "M06L", "MBJLDA", "REVTPSS"],
                       category="高级", description="Meta-GGA泛函"),
    "LASPH": TagMeta(tag="LASPH", type="bool", default=False,
                     category="高级", description="非球面项贡献"),

    # ===== Dielectric =====
    "LEPSILON": TagMeta(tag="LEPSILON", type="bool", default=False,
                        category="介电", description="静态介电张量/压电/玻恩电荷"),
    "LCALCEPS": TagMeta(tag="LCALCEPS", type="bool", default=False,
                        category="介电", description="DFPT计算介电张量"),

    # ===== NEB =====
    "IMAGES": TagMeta(tag="IMAGES", type="int", default=0, min_val=0, max_val=100,
                      category="NEB", description="NEB中间像点数"),
    "SPRING": TagMeta(tag="SPRING", type="float", default=-5.0, category="NEB", description="弹簧常数"),
    "LCLIMB": TagMeta(tag="LCLIMB", type="bool", default=False, category="NEB", description="CI-NEB"),

    # ===== External Field =====
    "EFIELD": TagMeta(tag="EFIELD", type="float", default=0.0, advanced=True,
                      category="特殊", description="外电场强度(eV/A)"),
    "LDIPOL": TagMeta(tag="LDIPOL", type="bool", default=False,
                      category="特殊", description="偶极修正"),
    "IDIPOL": TagMeta(tag="IDIPOL", type="enum", default=None, options=[None, 1, 2, 3],
                      category="特殊", description="偶极方向"),
    "DIPOL": TagMeta(tag="DIPOL", type="list", default=[0.5, 0.5, 0.5],
                     category="特殊", description="偶极修正中心"),

    # ===== Solvent =====
    "LSOL": TagMeta(tag="LSOL", type="bool", default=False,
                    category="溶剂", description="隐式溶剂模型(VASPsol)"),
    "EB": TagMeta(tag="EB", type="float", default=80.0, min_val=1.0, max_val=200.0,
                  category="溶剂", description="溶剂介电常数"),

    # ===== XAS =====
    "ICORELEVEL": TagMeta(tag="ICORELEVEL", type="enum", default=None, options=[None, 0, 1, 2],
                          advanced=True, category="光谱", description="芯态激发方法"),

    # ===== MD =====
    "MDALGO": TagMeta(tag="MDALGO", type="enum", default=None,
                      options=[None, 0, 1, 2, 3, 11, 21, 13],
                      advanced=True, category="离子", description="MD算法"),
    "TEBEG": TagMeta(tag="TEBEG", type="float", default=300.0, min_val=0.0, max_val=10000.0,
                     unit="K", category="离子", description="MD起始温度"),
    "TEEND": TagMeta(tag="TEEND", type="float", default=300.0, min_val=0.0, max_val=10000.0,
                     unit="K", category="离子", description="MD终止温度"),

    # ===== Parallel =====
    "NCORE": TagMeta(tag="NCORE", type="int", default=1, min_val=1, max_val=128,
                     advanced=True, category="基础", description="每轨道核数"),
    "KPAR": TagMeta(tag="KPAR", type="int", default=1, min_val=1, max_val=128,
                    advanced=True, category="基础", description="k点并行数"),
    "NPAR": TagMeta(tag="NPAR", type="int", default=1, min_val=1, max_val=128,
                    advanced=True, category="基础", description="能带并行数"),

    # ===== Misc =====
    "ISYM": TagMeta(tag="ISYM", type="enum", default=2, options=[-1, 0, 1, 2, 3],
                    advanced=True, category="基础", description="对称性处理"),
    "GGA": TagMeta(tag="GGA", type="enum", default="PE",
                   options=["PE", "91", "AM", "PS", "RE", "RP", "CA", "B3", "BF", "CO", "CX", "MK", "ML", "OR"],
                   advanced=True, category="基础", description="GGA泛函类型"),
    "CSHIFT": TagMeta(tag="CSHIFT", type="float", default=0.1, advanced=True,
                      category="光学", description="光学性质复位移"),
    "PSTRESS": TagMeta(tag="PSTRESS", type="float", default=0.0,
                       category="特殊", description="外部静水压(kBar)"),
    "NELECT": TagMeta(tag="NELECT", type="float", default=None,
                      category="特殊", description="体系总电子数"),
    "LWANNIER90": TagMeta(tag="LWANNIER90", type="bool", default=False,
                          advanced=True, category="特殊", description="Wannier90接口"),
    "LCONSTR": TagMeta(tag="LCONSTR", type="bool", default=False, advanced=True,
                       category="特殊", description="约束DFT(CDFT)"),
    "LEPC": TagMeta(tag="LEPC", type="bool", default=False, advanced=True,
                    category="输运", description="电子-声子耦合"),
    "LSPIRAL": TagMeta(tag="LSPIRAL", type="bool", default=False, advanced=True,
                       category="磁学", description="自旋螺旋磁结构"),
    "I_CONSTRAINED_M": TagMeta(tag="I_CONSTRAINED_M", type="int", default=0,
                               options=[0, 1, 2], advanced=True,
                               category="磁学", description="约束磁矩"),
}

def get_tag_meta(tag: str) -> TagMeta | None:
    return INCAR_TAG_REGISTRY.get(tag.upper())

def get_tags_by_category() -> dict[str, list[TagMeta]]:
    cats: dict[str, list[TagMeta]] = {}
    for tag, meta in INCAR_TAG_REGISTRY.items():
        cats.setdefault(meta.category, []).append(meta)
    return cats
