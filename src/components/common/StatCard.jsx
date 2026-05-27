function StatCard({ icon, title, value, subtitle }) {
  return (
    <div className="card stat-card">
      <div className="stat-card-top">
        <div className="stat-icon">
          {icon}
        </div>
      </div>

      <div className="stat-card-content">
        <h4>{title}</h4>
        <h2>{value}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

export default StatCard;
