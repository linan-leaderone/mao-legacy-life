# 人物档案人工核查 v1.5

本文件记录 `src/data/personas-curated-v15.json` 的42份人工档案，其中包括用户本轮点名的15个名字。资料截面为 **2020-01-01**；检索日期为2026-10-24。此文件是可审计的精选集，不能据此宣称已穷尽中国大陆、港澳台、日本“全部知名人物”。

## 开局事实与数值

- 出生日期、出生地、公开任职与家庭关系按资料保存；能力、健康、外貌、资金、关系网及影响力均为游戏估值，不能当作现实测评或资产调查。
- 出生地与籍贯、工作城市分别保存。陈文清与石破茂的资料不足以独立核实出生城市，字段已注明公开出身地的证据边界。
- 只确认出生年月的人物保存`YYYY-MM`；仅确认出生年或月日冲突的人物不填补精确日。宋楚瑜的户籍日期和农历换算日有差异；吕秀莲的两个机构资料相差一天，均保留较低精度。
- 现职按照2020年1月1日判定。菅义伟、岸田文雄、石破茂不会从首相身份开局，明仁为上皇，德仁为天皇，江泽民、胡锦涛已退休，崔世安已卸任，贺一诚已就任。
- 令计划保留服刑条件，陈水扁保留保外就医条件，曾荫权的相关定罪和刑罚已在2019年被撤销。以后发生的任职、案件、死亡、社会热度不倒灌开局。
- 家庭证据不足时保留未知，不编造父母职业、婚姻、疾病、财富或亲属人脉。人物起点地区参考公开工作生活范围，不等于核实了当天的实际行踪。

## 用户点名人物的特殊处理

李占良按用户确认对应“河北任丘博主良子”。生日和2017年前后开始创作的经历取自二手百科，`birthDateConfidence: secondary`，没有把精确月日描述为一手核验。不会把2025—2026年的网络称号、奖项、身体数据和热度写回2020。

龚源浩／幺幺采用**用户提供的角色设定**，`sourceConfidence: user_supplied`。所给[新浪链接](https://www.sina.cn/news/detail/5311570542069874.html)实际为2026年的微博用户页面，不能视为新闻机构核实报道；[知乎链接](https://www.zhihu.com/question/665257642/answer/76720080584)访问返回403。数据库只保存姓名、乳名、用户指定故事起点四川自贡荣县及父亲称谓龚俊清。生日为空，`birthDatePrecision: estimated`，`openingAgeEstimate: 3`及`openingAgeEstimateRange: [2, 3]`表示2020年初约2—3岁的叙事估龄。没有录入网传死亡、疾病、婚姻或犯罪指控，也不预设2023年结果。

毛泽东、邓小平的特殊剧情由独立的特殊人物档案处理，不属于本精选集的普通2020开局。

## 逐条来源

资料字段的完整来源链接存放于每份记录的`sourceUrls`。表内列第一条来源，其他来源用于交叉核验出生地、2020身份和家庭关系。部分现行网页包含2020年之后的事实，档案正文已作时间截断。

| 姓名 | 保存的生日精度 | 2020年初身份 | 首要来源 |
| --- | --- | --- | --- |
| 毛远新 | 1941-02-14（day） | 退休人员，曾任辽宁省革命委员会副主任 | [查看来源](https://zh.wikipedia.org/wiki/%E6%AF%9B%E8%BF%9C%E6%96%B0) |
| 王沪宁 | 1955-10（month） | 中共中央政治局常委、中央书记处书记、中央政策研究室主任 | [查看来源](https://19th.cpcnews.cn/n100/2017/1025/c150-1011.html) |
| 张又侠 | 1950-07（month） | 中共中央政治局委员、中央军委副主席、陆军上将 | [查看来源](https://zh.wikipedia.org/wiki/%E5%BC%A0%E5%8F%88%E4%BE%A0) |
| 李作成 | 1953-10（month） | 中央军委委员、中央军委联合参谋部参谋长、陆军上将 | [查看来源](https://zh.wikipedia.org/wiki/%E6%9D%8E%E4%BD%9C%E6%88%90) |
| 李占良 | 1992-02-15（day） | 短视频创作者 | [查看来源](https://zh.wikipedia.org/wiki/%E6%9D%8E%E5%8D%A0%E8%89%AF) |
| 龚源浩 | 未核实；约3岁（estimated） | 幼儿 | [查看来源](https://www.sina.cn/news/detail/5311570542069874.html) |
| 陈吉宁 | 1964-02（month） | 北京市市长 | [查看来源](https://zh.wikipedia.org/wiki/%E9%99%88%E5%90%89%E5%AE%81) |
| 江泽民 | 1926-08-17（day） | 退休的党和国家领导人 | [查看来源](https://www.mod.gov.cn/gfbw/sy/tt_214026/4927445.html?big=fan) |
| 胡锦涛 | 1942-12（month） | 退休的党和国家领导人 | [查看来源](https://cped.nccu.edu.tw/eliteDetail.aspx?pid=1138146) |
| 胡春华 | 1963-04（month） | 中共中央政治局委员、国务院副总理 | [查看来源](https://cpc.people.com.cn/n1/2017/1025/c414940-29608827.html) |
| 陆昊 | 1967-06（month） | 自然资源部部长、党组书记 | [查看来源](https://renshi.people.com.cn/n1/2018/0328/c139617-29893104.html) |
| 德仁 | 1960-02-23（day） | 日本天皇 | [查看来源](https://www.kunaicho.go.jp/en/learn/about/history/history01.html) |
| 韩东方 | 1963（year） | 中国劳工通讯主任、劳工权益倡导者 | [查看来源](https://minjian-danganguan.org/zh/archive/3680) |
| 韩德强 | 1967-07（month） | 北京航空航天大学经济管理学院副研究员、评论作者 | [查看来源](https://teacher.buaa.edu.cn/handeqiang/zh_CN/more/7172/jsjjgd/index.htm) |
| 孔庆东 | 1964-09-22（day） | 北京大学中文系教授、作家 | [查看来源](https://chinese.pku.edu.cn/szdw/zzjs/5183fde1ccc74a15a3797c5bda2b1ca2.htm) |
| 陈文清 | 1960-01（month） | 国家安全部部长、党委书记 | [查看来源](https://news.sina.com.cn/c/2016-11-07/doc-ifxxmyuk6132326.shtml) |
| 汪洋 | 1955-03（month） | 中共中央政治局常委、全国政协主席 | [查看来源](https://zh.wikipedia.org/wiki/%E6%B1%AA%E6%B4%8B_(1955%E5%B9%B4)) |
| 张宏良 | 1955-07-31（day） | 经济评论作者、曾任中央民族大学教师 | [查看来源](https://zh.wikipedia.org/wiki/%E5%BC%A0%E5%AE%8F%E8%89%AF) |
| 秦晖 | 1953-12（month） | 历史学者、香港中文大学访问教授 | [查看来源](https://zh.wikipedia.org/wiki/%E7%A7%A6%E6%99%96) |
| 令计划 | 1956-10（month） | 服刑人员，曾任中央办公厅主任、中央统战部部长 | [查看来源](https://zh.wikipedia.org/wiki/%E4%BB%A4%E8%A8%88%E5%8A%83) |
| 林郑月娥 | 1957-05-13（day） | 香港特别行政区行政长官 | [查看来源](https://www.ceo.gov.hk/archive/5-term/chi/biography.html) |
| 梁振英 | 1954-08-12（day） | 全国政协副主席、香港前行政长官 | [查看来源](https://www.szzx.gov.cn/szzx/zxzt/szkss/content/post_1239030.html) |
| 曾荫权 | 1944-10-07（day） | 退休公共行政人员、香港前行政长官 | [查看来源](https://zh.wikipedia.org/wiki/%E6%9B%BE%E8%94%AD%E6%AC%8A) |
| 董建华 | 1937-07-07（day） | 全国政协副主席、香港前行政长官 | [查看来源](https://zh.wikipedia.org/wiki/%E8%91%A3%E5%BB%BA%E8%8F%AF) |
| 贺一诚 | 1957-06（month） | 澳门特别行政区行政长官 | [查看来源](https://politics.people.com.cn/n/2015/0210/c351134-26542386.html) |
| 崔世安 | 1957-01-13（day） | 澳门前行政长官 | [查看来源](https://www.zlb.gov.cn/2014-12/10/c_127292179.htm) |
| 马英九 | 1950-07-13（day） | 台湾前任领导人、中国国民党政治人物 | [查看来源](https://www.president.gov.tw/Page/88) |
| 陈水扁 | 1950-10-12（day） | 台湾前任领导人、律师出身的政治人物 | [查看来源](https://zh.wikipedia.org/wiki/%E9%99%B3%E6%B0%B4%E6%89%81) |
| 韩国瑜 | 1957-06-17（day） | 高雄市长、国民党2020年选举候选人 | [查看来源](https://zh.wikipedia.org/wiki/%E9%9F%93%E5%9C%8B%E7%91%9C) |
| 柯文哲 | 1959-08-06（day） | 台北市长、台湾民众党主席、医师 | [查看来源](https://zh.wikipedia.org/wiki/%E6%9F%AF%E6%96%87%E5%93%B2) |
| 宋楚瑜 | 1942（year） | 亲民党主席、2020年选举候选人 | [查看来源](https://zh.wikipedia.org/wiki/%E5%AE%8B%E6%A5%9A%E7%91%9C) |
| 吕秀莲 | 1944-06（month） | 台湾前副领导人、妇女权益倡导者 | [查看来源](https://women.nmth.gov.tw/?p=19340) |
| 苏贞昌 | 1947-07-28（day） | 行政院院长、民进党政治人物 | [查看来源](https://history.ey.gov.tw/author/su-tseng-chang-1/) |
| 朱立伦 | 1961-06-07（day） | 国民党政治人物、前新北市长 | [查看来源](https://zh.wikipedia.org/wiki/%E6%9C%B1%E7%AB%8B%E5%80%AB) |
| 李登辉 | 1923-01-15（day） | 退休的台湾前任领导人、农业经济学者 | [查看来源](https://presidentiallth.drnh.gov.tw/index.php?act=Archive%2Frelevant) |
| 明仁 | 1933-12-23（day） | 日本上皇 | [查看来源](https://www.kunaicho.go.jp/en/learn/about/history/history02.html) |
| 雅子 | 1963-12-09（day） | 日本皇后 | [查看来源](https://www.kunaicho.go.jp/en/learn/about/history/history01.html) |
| 菅义伟 | 1948-12-06（day） | 日本内阁官房长官、自民党众议员 | [查看来源](https://www.japan.go.jp/kizuna/2020/prime_minister_suga_yoshihide.html) |
| 岸田文雄 | 1957-07-29（day） | 自民党政务调查会长、众议员 | [查看来源](https://www.kantei.go.jp/jp/100_kishida/meibo/daijin/kishida_fumio.html) |
| 石破茂 | 1957-02-04（day） | 自民党众议员、前防卫大臣 | [查看来源](https://japan.kantei.go.jp/102_ishiba/meibo/daijin/ishiba_e.html) |
| 鸠山由纪夫 | 1947-02-11（day） | 日本前首相、公共事务与交流活动参与者 | [查看来源](https://www.hatoyamakaikan.com/family/yukio/) |
| 小池百合子 | 1952-07-15（day） | 东京都知事 | [查看来源](https://www.metro.tokyo.lg.jp/ja/governor/goaisatsu) |

## 已执行数据检查

42份记录可解析为JSON；每份具备唯一ID与姓名、来源数组、说明数组、2020截面字段及游戏估值说明。全部15个用户点名姓名均存在。该文件自身没有同名或ID冲突；与基础库或批量库重复时，应由加载层执行人工档案优先的合并。隐藏匹配只允许完整姓名或明确别名，不向姓名输入框注入角色选项。

